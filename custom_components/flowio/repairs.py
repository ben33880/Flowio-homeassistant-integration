import voluptuous as vol

from homeassistant.components.repairs import RepairsFlow
from homeassistant.core import HomeAssistant

from .const import CONF_NOTIFY


class NotifyServiceFix(RepairsFlow):
    """Permet de saisir un service de notification existant."""

    def __init__(self, entry_id: str) -> None:
        self._entry_id = entry_id

    async def async_step_init(self, user_input=None):
        return await self.async_step_confirm()

    async def async_step_confirm(self, user_input=None):
        entry = self.hass.config_entries.async_get_entry(self._entry_id)
        errors = {}
        if user_input is not None and entry is not None:
            service = user_input[CONF_NOTIFY].strip()
            domain, _, name = service.partition(".")
            if name and self.hass.services.has_service(domain, name):
                self.hass.config_entries.async_update_entry(
                    entry, options={**entry.options, CONF_NOTIFY: service}
                )
                return self.async_create_entry(data={})
            errors["base"] = "service_not_found"
        current = ""
        if entry is not None:
            current = entry.options.get(CONF_NOTIFY) or entry.data.get(CONF_NOTIFY, "")
        return self.async_show_form(
            step_id="confirm",
            data_schema=vol.Schema({vol.Required(CONF_NOTIFY, default=current): str}),
            errors=errors,
        )


async def async_create_fix_flow(hass: HomeAssistant, issue_id: str, data) -> RepairsFlow:
    if issue_id.startswith("notify_service_missing") and data and "entry_id" in data:
        return NotifyServiceFix(str(data["entry_id"]))
    raise ValueError(f"Réparation inconnue : {issue_id}")
