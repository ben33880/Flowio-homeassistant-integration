import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback

from .const import (
    CONF_DIS_SLOT,
    CONF_NOTIFY,
    CONF_NOTIFY_MEDIUM,
    CONF_PH_SLOT,
    CONF_PREFIX,
    DEFAULT_DIS_SLOT,
    DEFAULT_PH_SLOT,
    DOMAIN,
)

_SLOT = vol.All(vol.Coerce(int), vol.Range(min=0, max=15))


def _schema(d: dict) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_PREFIX, default=d.get(CONF_PREFIX, "fio")): str,
            vol.Required(CONF_NOTIFY, default=d.get(CONF_NOTIFY, "notify.notify")): str,
            vol.Required(CONF_PH_SLOT, default=d.get(CONF_PH_SLOT, DEFAULT_PH_SLOT)): _SLOT,
            vol.Required(CONF_DIS_SLOT, default=d.get(CONF_DIS_SLOT, DEFAULT_DIS_SLOT)): _SLOT,
            vol.Required(CONF_NOTIFY_MEDIUM, default=d.get(CONF_NOTIFY_MEDIUM, False)): bool,
        }
    )


class FlowioConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_PREFIX])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title=f"Flow.io ({user_input[CONF_PREFIX]})", data=user_input)
        return self.async_show_form(step_id="user", data_schema=_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FlowioOptionsFlow()


class FlowioOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        current = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(step_id="init", data_schema=_schema(current))
