import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

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

# Zone de saisie (et non un curseur) pour les slots 0 à 15.
_SLOT = selector.NumberSelector(
    selector.NumberSelectorConfig(min=0, max=15, step=1, mode=selector.NumberSelectorMode.BOX)
)


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


def _clean(user_input: dict) -> dict:
    """Le sélecteur numérique renvoie des décimaux : les slots sont enregistrés en entiers."""
    data = dict(user_input)
    for key in (CONF_PH_SLOT, CONF_DIS_SLOT):
        data[key] = int(data[key])
    return data


class FlowioConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            data = _clean(user_input)
            await self.async_set_unique_id(data[CONF_PREFIX])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title=f"Flow.io ({data[CONF_PREFIX]})", data=data)
        return self.async_show_form(step_id="user", data_schema=_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FlowioOptionsFlow()


class FlowioOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(data=_clean(user_input))
        current = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(step_id="init", data_schema=_schema(current))
