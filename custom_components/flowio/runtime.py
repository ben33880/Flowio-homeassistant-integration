from dataclasses import dataclass, field

from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo

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
        self.signal = SIGNAL_UPDATE.format(entry_id=entry.entry_id)
        self.signal_pumps = SIGNAL_PUMPS.format(entry_id=entry.entry_id)

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

    async def async_notify(self, title: str, message: str, tag: str) -> None:
        service = self.conf.get(CONF_NOTIFY)
        if not service or "." not in service:
            return
        domain, name = service.split(".", 1)
        await self.hass.services.async_call(
            domain, name, {"title": title, "message": message, "data": {"tag": f"flowio_{tag}"}}
        )
