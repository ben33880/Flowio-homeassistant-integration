import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from html import escape

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.util import dt as dt_util
from homeassistant.util import slugify

from .const import (
    CONF_DIS_SLOT,
    CONF_IOS_LEVEL,
    CONF_MOBILE_DEVICES,
    CONF_NOTIFY_RECAP,
    CONF_PH_SLOT,
    CONF_PREFIX,
    DEFAULT_DIS_SLOT,
    DEFAULT_IOS_LEVEL,
    DEFAULT_PH_SLOT,
    DOMAIN,
    SIGNAL_PUMPS,
    SIGNAL_UPDATE,
    THRESHOLDS,
)
from .health import HealthMonitor
from .quality import BAD, GOOD, MEDIUM, as_float, grade

_LOGGER = logging.getLogger(__name__)

# Alertes de cuve basse -> cuve concernée par le bouton « Cuve remplie ».
REFILL_ALERTS = {"ph_tank_low": "ph", "dis_tank_low": "disinfection"}

# Couleurs de l'application mobile (Android : accent ; iPhone : fond de l'icône).
COLOR_ALERT = "#F44336"
COLOR_OK = "#4CAF50"
COLOR_OFF = "#607D8B"
COLOR_WARN = "#FF9800"

# iPhone : la couleur n'est visible que sur une notification de communication, qui exige une icône.
# Icône de secours quand l'équipement n'en a pas ; glyphe blanc pour rester lisible sur le fond coloré.
DEFAULT_ICON = "mdi:pool"
IOS_GLYPH_COLOR = "#FFFFFF"

# Qualité d'une valeur : couleur du texte (Android) et pastille (Android et iPhone).
GRADE_COLORS = {GOOD: "#4CAF50", MEDIUM: COLOR_WARN, BAD: "#F44336"}
GRADE_DOTS = {GOOD: "🟢", MEDIUM: "🟠", BAD: "🔴"}

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


@dataclass(frozen=True)
class MobileTarget:
    name: str  # nom de l'appareil, pour les journaux
    service: str  # service notify (sans le « notify. »)
    android: bool  # sinon iPhone ou autre : texte natif


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
        self.loaded_at = dt_util.utcnow()  # début de l'observation : avant, les durées ne sont pas fiables
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

    def resolve_targets(self) -> tuple[list[MobileTarget], list[str]]:
        """Appareils mobiles choisis : (joignables, noms des injoignables)."""
        registry = dr.async_get(self.hass)
        found: list[MobileTarget] = []
        missing: list[str] = []
        for device_id in self.conf.get(CONF_MOBILE_DEVICES) or []:
            device = registry.async_get(device_id)
            entry = None
            if device is not None:
                for entry_id in device.config_entries:
                    candidate = self.hass.config_entries.async_get_entry(entry_id)
                    if candidate is not None and candidate.domain == "mobile_app":
                        entry = candidate
                        break
            if entry is None:
                missing.append(device.name if device and device.name else "appareil supprimé")
                continue
            raw_name = entry.data.get("device_name") or device.name or ""
            service = f"mobile_app_{slugify(raw_name)}"
            if not raw_name or not self.hass.services.has_service("notify", service):
                missing.append(raw_name or device_id)
                continue
            found.append(MobileTarget(raw_name, service, entry.data.get("os_name") == "Android"))
        return found, missing

    def unreachable_targets(self) -> list[str]:
        return self.resolve_targets()[1]

    def _actions(self, key: str) -> list[dict]:
        # Boutons : Android et iPhone (actions intégrées à la notification, iOS 2021.5 ou plus récent).
        head = f"flowio_{self.prefix}_"
        actions = [{"action": f"{head}snooze_{key}", "title": "Reporter 24 h"}]
        if key in REFILL_ALERTS:
            actions.insert(0, {"action": f"{head}refill_{key}", "title": "Cuve remplie"})
        return actions

    def _reading(
        self,
        template: str,
        label: str,
        decimals: int,
        default_unit: str = "",
        band: str | None = None,
        html: bool = False,
    ) -> str | None:
        state = self.hass.states.get(self.resolve(template))
        value = as_float(state)
        if value is None:
            return None
        unit = state.attributes.get("unit_of_measurement") or default_unit
        text = fmt(value, decimals) + (f" {unit}" if unit else "")
        level = grade(self.values, band, value) if band else None
        dot = f" {GRADE_DOTS[level]}" if level in GRADE_DOTS else ""
        if not html:
            return f"{label} {text}{dot}"
        color = GRADE_COLORS.get(level)
        shown = f'<span style="color: {color}">{escape(text)}</span>' if color else escape(text)
        return f"<b>{label}</b> {shown}{dot}"

    def context_line(self, html: bool = False) -> str:
        """Récapitulatif : une ligne par groupe, chacune avec son emoji.

        🧪 pH et ORP (pastille de qualité), 🌡️ eau et air, 📊 pression. Filtration arrêtée : une ligne
        ⚠️ prévient que le pH et l'ORP sont peu fiables. En HTML (Android) : libellés en gras, valeurs
        de pH et d'ORP colorées selon la qualité, avertissement en italique orange.
        """
        groups = [
            (
                "🧪",
                [
                    self._reading("sensor.{p}_io_ph", "pH", 2, band="ph", html=html),
                    self._reading("sensor.{p}_io_orp", "ORP", 0, "mV", band="orp", html=html),
                ],
            ),
            (
                "🌡️",
                [
                    self._reading("sensor.{p}_io_wat_tmp", "Eau", 1, "°C", html=html),
                    self._reading("sensor.{p}_io_air_tmp", "Air", 1, "°C", html=html),
                ],
            ),
            ("📊", [self._reading("sensor.{p}_io_psi", "Pression", 1, html=html)]),
        ]
        lines = []
        for icon, items in groups:
            parts = [item for item in items if item]
            if parts:
                lines.append(f"{icon} " + " · ".join(parts))
        flt = self.hass.states.get(self.resolve("switch.{p}_io_flt_pmp"))
        if flt is not None and flt.state == "off":
            note = "⚠️ Filtration arrêtée : pH et ORP peu fiables"
            lines.append(f'<i><span style="color: {COLOR_WARN}">{note}</span></i>' if html else note)
        return ("<br>" if html else "\n").join(lines)

    async def async_notify(self, title: str, message: str, tag: str, alert_on: bool | None = None) -> None:
        """Notification d'alerte : supprimée si l'alerte est reportée ; boutons seulement au déclenchement."""
        if self.is_snoozed(tag):
            return
        if alert_on is True:
            await self.async_send(
                title,
                f"🚨 {message}".strip(),
                tag,
                self._actions(tag),
                color=COLOR_ALERT,
                icon="mdi:alert-circle",
                channel=ALERT_CHANNEL,
                urgent=True,
                level=self.conf.get(CONF_IOS_LEVEL, DEFAULT_IOS_LEVEL),
                recap=True,
            )
        elif alert_on is False:
            await self.async_send(
                title,
                f"✅ {message}".strip(),
                tag,
                color=COLOR_OK,
                icon="mdi:check-circle",
                channel=ALERT_CHANNEL,
                level="passive",
                recap=True,
            )
        else:
            await self.async_send(title, message, tag, recap=True)

    async def async_send(
        self,
        title: str,
        message: str,
        tag: str,
        actions: list[dict] | None = None,
        *,
        color: str | None = None,
        icon: str | None = None,
        url: str | None = None,
        channel: str | None = None,
        urgent: bool = False,
        level: str | None = None,
        recap: bool = False,
    ) -> None:
        """Envoie la notification à chaque appareil choisi, avec le format de sa plateforme.

        Android : HTML (gras, couleurs), canal, priorité, clickAction. iPhone : texte natif, url, niveau
        d'interruption, couleur du fond de l'icône. Un échec sur un appareil n'empêche pas les autres.
        """
        targets, _missing = self.resolve_targets()
        if not targets:
            return
        show_recap = recap and self.conf.get(CONF_NOTIFY_RECAP, True)
        plain = self.context_line(html=False) if show_recap else ""
        rich = self.context_line(html=True) if show_recap else ""
        for target in targets:
            # Le préfixe dans le tag évite que deux installations se remplacent mutuellement.
            data: dict = {"tag": f"flowio_{self.prefix}_{tag}", "group": f"flowio_{self.prefix}"}
            if color:
                data["color"] = color
            if icon or color:
                data["notification_icon"] = icon or DEFAULT_ICON
            if target.android:
                body, extra, sep = escape(message), rich, "<br>"
                if body and color:
                    body = f'<b><span style="color: {color}">{body}</span></b>'
                if channel:
                    data["channel"] = channel
                if urgent:
                    data.update({"importance": "high", "priority": "high", "ttl": 0})
                if url:
                    data["clickAction"] = url
            else:
                body, extra, sep = message, plain, "\n"
                if color:
                    data["notification_icon_color"] = IOS_GLYPH_COLOR
                if url:
                    data["url"] = url
                if level:
                    data["push"] = {"interruption-level": level}
            if actions:
                data["actions"] = actions
            text = sep.join(part for part in (body, extra) if part) or "Flow.io"
            await self._deliver(target, title, text, data)

    def _live_tag(self, tag: str) -> str:
        # L'identifiant d'une activité en direct : lettres, chiffres, tirets et underscores, 64 caractères max.
        return f"flowio_{self.prefix}_live_{tag}"[:64]

    async def async_send_live(
        self,
        title: str,
        tag: str,
        *,
        started: datetime,
        color: str | None = None,
        icon: str | None = None,
        url: str | None = None,
    ) -> None:
        """Suivi en direct : Live Activity (iPhone) / Live Update (Android), avec chronomètre depuis le démarrage.

        Le titre est figé à la création ; le chronomètre tourne sur le téléphone sans autre envoi.
        Un téléphone qui ne gère pas la fonction affiche une notification normale.
        """
        targets, _missing = self.resolve_targets()
        message = self.context_line(html=False) if self.conf.get(CONF_NOTIFY_RECAP, True) else ""
        for target in targets:
            data: dict = {
                "tag": self._live_tag(tag),
                "live_update": True,
                "chronometer": True,
                "when": int(started.timestamp()),
                "when_relative": False,
                "critical_text": "En marche",
            }
            if color:
                data["color"] = color
                data["notification_icon_color"] = color
            data["notification_icon"] = icon or DEFAULT_ICON
            if url:
                data["url"] = url
            await self._deliver(target, title, message or "En marche", data)

    async def async_clear_live(self, tag: str) -> None:
        """Termine le suivi en direct et retire la notification correspondante."""
        targets, _missing = self.resolve_targets()
        for target in targets:
            await self._deliver(target, "", "clear_notification", {"tag": self._live_tag(tag)})

    async def _deliver(self, target: MobileTarget, title: str, message: str, data: dict) -> None:
        payload: dict = {"message": message, "data": data}
        if title:
            payload["title"] = title
        try:
            await self.hass.services.async_call("notify", target.service, payload, blocking=True)
        except HomeAssistantError as err:
            _LOGGER.warning("Notification vers %s impossible : %s", target.name, err)
