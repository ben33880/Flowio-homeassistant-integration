from dataclasses import dataclass, field
from datetime import datetime, timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.util import dt as dt_util

from .const import (
    CONF_DIS_SLOT,
    CONF_NOTIFY,
    CONF_PH_SLOT,
    CONF_PREFIX,
    DEFAULT_DIS_SLOT,
    DEFAULT_PH_SLOT,
    DOMAIN,
    SIGNAL_PUMPS,
    SIGNAL_UPDATE,
    THRESHOLDS,
)
from .health import HealthMonitor
from .quality import as_float

# Alertes de cuve basse -> cuve concernée par le bouton « Cuve remplie ».
REFILL_ALERTS = {"ph_tank_low": "ph", "dis_tank_low": "disinfection"}

# Couleurs de l'application Android (ignorées ailleurs).
COLOR_ALERT = "#F44336"
COLOR_OK = "#4CAF50"
COLOR_OFF = "#607D8B"

ALERT_CHANNEL = "Flow.io alertes"


def fmt(value: float, decimals: int) -> str:
    """Nombre à la française (virgule décimale)."""
    return f"{value:.{decimals}f}".replace(".", ",")


def format_duration(delta: timedelta) -> str:
    seconds = max(int(delta.total_seconds()), 0)
    if seconds < 60:
        return f"{seconds} s"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min"
    hours, minutes = divmod(minutes, 60)
    if hours < 24:
        return f"{hours} h {minutes:02d}"
    days, hours = divmod(hours, 24)
    return f"{days} j {hours} h"


@dataclass
class PumpModel:
    history: list[float] = field(default_factory=list)  # totaux journaliers (mL) des derniers jours
    last_ml: float | None = None


class FlowioRuntime:
    def __init__(self, hass: HomeAssistant, entry):
        self.hass, self.entry = hass, entry
        self.conf = {**entry.data, **entry.options}
        self.prefix = self.conf[CONF_PREFIX]
        self.ph_slot = int(self.conf.get(CONF_PH_SLOT, DEFAULT_PH_SLOT))
        self.dis_slot = int(self.conf.get(CONF_DIS_SLOT, DEFAULT_DIS_SLOT))
        self.values = {t.key: t.default for t in THRESHOLDS}
        self.pumps = {"ph": PumpModel(), "dis": PumpModel()}
        self.restarts: list[datetime] = []
        self.snoozed: dict[str, datetime] = {}  # alerte -> fin du report (en mémoire)
        self.signal = SIGNAL_UPDATE.format(entry_id=entry.entry_id)
        self.signal_pumps = SIGNAL_PUMPS.format(entry_id=entry.entry_id)
        self.health = HealthMonitor(self)

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self.prefix)},
            name=f"Flow.io ({self.prefix})",
            manufacturer="Flow.io",
            model="Waveshare",
        )

    def resolve(self, template: str) -> str:
        # Cuves : data_(112 + 2*slot) = volume, +1 = pourcentage. Compteurs de marche : data_(144 + slot).
        return template.format(
            p=self.prefix,
            ph_vol=112 + 2 * self.ph_slot,
            ph_pct=113 + 2 * self.ph_slot,
            dis_vol=112 + 2 * self.dis_slot,
            dis_pct=113 + 2 * self.dis_slot,
            ph_rt=144 + self.ph_slot,
            dis_rt=144 + self.dis_slot,
        )

    def snooze(self, key: str, hours: float) -> None:
        self.snoozed[key] = dt_util.utcnow() + timedelta(hours=hours)

    def is_snoozed(self, key: str) -> bool:
        until = self.snoozed.get(key)
        return until is not None and dt_util.utcnow() < until

    @property
    def is_mobile(self) -> bool:
        return (self.conf.get(CONF_NOTIFY) or "").startswith("notify.mobile_app_")

    def _actions(self, key: str) -> list[dict] | None:
        # Actions dynamiques : application Android uniquement (service notify.mobile_app_*).
        if not self.is_mobile:
            return None
        head = f"flowio_{self.prefix}_"
        actions = [{"action": f"{head}snooze_{key}", "title": "Reporter 24 h"}]
        if key in REFILL_ALERTS:
            actions.insert(0, {"action": f"{head}refill_{key}", "title": "Cuve remplie"})
        return actions

    def _reading(self, template: str, label: str, decimals: int, default_unit: str = "") -> str | None:
        state = self.hass.states.get(self.resolve(template))
        value = as_float(state)
        if value is None:
            return None
        unit = state.attributes.get("unit_of_measurement") or default_unit
        return f"{label} {fmt(value, decimals)}" + (f" {unit}" if unit else "")

    def context_line(self, about: str | None = None) -> str:
        """Récapitulatif : pH et ORP, températures de l'eau et de l'air, pression (une ligne par groupe)."""
        groups = [
            [
                self._reading("sensor.{p}_io_ph", "pH", 2),
                self._reading("sensor.{p}_io_orp", "ORP", 0, "mV"),
            ],
            [
                self._reading("sensor.{p}_io_wat_tmp", "Eau", 1, "°C"),
                self._reading("sensor.{p}_io_air_tmp", "Air", 1, "°C"),
            ],
            [self._reading("sensor.{p}_io_psi", "Pression", 1)],
        ]
        lines = [" · ".join(item for item in group if item) for group in groups]
        return "\n".join(line for line in lines if line)

    async def async_notify(self, title: str, message: str, tag: str, alert_on: bool | None = None) -> None:
        """Notification d'alerte : supprimée si l'alerte est reportée ; boutons seulement au déclenchement."""
        if self.is_snoozed(tag):
            return
        if alert_on is True:
            style = {
                "color": COLOR_ALERT,
                "notification_icon": "mdi:alert-circle",
                "channel": ALERT_CHANNEL,
                "importance": "high",
                "priority": "high",
                "ttl": 0,
            }
        elif alert_on is False:
            style = {"color": COLOR_OK, "notification_icon": "mdi:check-circle", "channel": ALERT_CHANNEL}
        else:
            style = None
        await self.async_send(
            title, message, tag, self._actions(tag) if alert_on else None, style=style, context=True
        )

    async def async_send(
        self,
        title: str,
        message: str,
        tag: str,
        actions: list[dict] | None = None,
        style: dict | None = None,
        context: bool = False,
        about: str | None = None,
    ) -> None:
        service = self.conf.get(CONF_NOTIFY)
        if not service or "." not in service:
            return
        domain, name = service.split(".", 1)
        if context:
            extra = self.context_line(about)
            if extra:
                message = f"{message}\n{extra}"
        # Le préfixe dans le tag évite que deux installations se remplacent mutuellement.
        data = {"tag": f"flowio_{self.prefix}_{tag}"}
        if self.is_mobile:
            data["group"] = f"flowio_{self.prefix}"
            if style:
                data.update(style)
        if actions:
            data["actions"] = actions
        await self.hass.services.async_call(
            domain, name, {"title": title, "message": message, "data": data}
        )
