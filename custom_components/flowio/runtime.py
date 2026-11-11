from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo

from .const import CONF_NOTIFY, CONF_PREFIX, DOMAIN, SIGNAL_UPDATE, THRESHOLDS


class FlowioRuntime:
    def __init__(self, hass: HomeAssistant, entry):
        self.hass, self.entry = hass, entry
        self.conf = {**entry.data, **entry.options}
        self.prefix = self.conf[CONF_PREFIX]
        self.values = {t.key: t.default for t in THRESHOLDS}
        self.signal = SIGNAL_UPDATE.format(entry_id=entry.entry_id)

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self.prefix)},
            name=f"Flow.io ({self.prefix})",
            manufacturer="Flow.io",
            model="Waveshare",
        )

    def resolve(self, template: str) -> str | None:
        if template.startswith("conf:"):
            return self.conf.get(template[5:]) or None
        return template.format(p=self.prefix)

    async def async_notify(self, title: str, message: str, tag: str) -> None:
        service = self.conf.get(CONF_NOTIFY)
        if not service or "." not in service:
            return
        domain, name = service.split(".", 1)
        await self.hass.services.async_call(
            domain, name, {"title": title, "message": message, "data": {"tag": f"flowio_{tag}"}}
        )
