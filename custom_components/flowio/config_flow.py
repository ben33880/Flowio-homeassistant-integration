import re

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_DIS_SLOT,
    CONF_MQTT_ROOT,
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

# Même règle que les cartes : minuscules, chiffres et underscores, non vide.
_PREFIX_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")


def _schema(d: dict) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_PREFIX, default=d.get(CONF_PREFIX, "fio")): str,
            vol.Required(CONF_NOTIFY, default=d.get(CONF_NOTIFY, "notify.notify")): str,
            vol.Optional(CONF_MQTT_ROOT, default=d.get(CONF_MQTT_ROOT, "")): str,
            vol.Required(CONF_PH_SLOT, default=d.get(CONF_PH_SLOT, DEFAULT_PH_SLOT)): _SLOT,
            vol.Required(CONF_DIS_SLOT, default=d.get(CONF_DIS_SLOT, DEFAULT_DIS_SLOT)): _SLOT,
            vol.Required(CONF_NOTIFY_MEDIUM, default=d.get(CONF_NOTIFY_MEDIUM, False)): bool,
        }
    )


def _clean(user_input: dict) -> dict:
    """Préfixe en minuscules sans espace ni underscore final ; slots en entiers ; racine MQTT sans barres de bord."""
    data = dict(user_input)
    data[CONF_PREFIX] = (data.get(CONF_PREFIX) or "").strip().lower().rstrip("_")
    for key in (CONF_PH_SLOT, CONF_DIS_SLOT):
        data[key] = int(data[key])
    data[CONF_MQTT_ROOT] = (data.get(CONF_MQTT_ROOT) or "").strip().strip("/")
    return data


def _root_ok(root: str) -> bool:
    """Vide (estimation seule) ou topic sans joker, espace ni segment vide."""
    return not root or not (any(c in root for c in "+# \t\n") or "//" in root)


def _validate(data: dict) -> dict:
    errors = {}
    if not _PREFIX_RE.match(data[CONF_PREFIX]):
        errors[CONF_PREFIX] = "invalid_prefix"
    if not _root_ok(data[CONF_MQTT_ROOT]):
        errors["base"] = "invalid_mqtt_root"
    return errors


class FlowioConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            data = _clean(user_input)
            errors = _validate(data)
            if not errors:
                await self.async_set_unique_id(data[CONF_PREFIX])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=f"Flow.io ({data[CONF_PREFIX]})", data=data)
        return self.async_show_form(
            step_id="user", data_schema=_schema(user_input or {}), errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return FlowioOptionsFlow()


class FlowioOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        errors = {}
        if user_input is not None:
            data = _clean(user_input)
            errors = _validate(data)
            if not errors:
                return self.async_create_entry(data=data)
        current = user_input or {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(step_id="init", data_schema=_schema(current), errors=errors)
