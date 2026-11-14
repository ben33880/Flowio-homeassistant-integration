import re

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_DIS_SLOT,
    CONF_IOS_LEVEL,
    CONF_MOBILE_DEVICES,
    CONF_MQTT_ROOT,
    CONF_NOTIFY_DEVICES,
    CONF_NOTIFY_MEDIUM,
    CONF_NOTIFY_ON_START,
    CONF_NOTIFY_ON_STOP,
    CONF_NOTIFY_RECAP,
    CONF_PH_SLOT,
    CONF_PREFIX,
    DEFAULT_DIS_SLOT,
    DEFAULT_IOS_LEVEL,
    DEFAULT_PH_SLOT,
    DOMAIN,
)

# Zone de saisie (et non un curseur) pour les slots 0 à 15.
_SLOT = selector.NumberSelector(
    selector.NumberSelectorConfig(min=0, max=15, step=1, mode=selector.NumberSelectorMode.BOX)
)

# Appareils de l'application mobile Home Assistant (plusieurs possibles).
_MOBILE = selector.DeviceSelector(
    selector.DeviceSelectorConfig(integration="mobile_app", multiple=True)
)

# Même règle que les cartes : minuscules, chiffres et underscores, non vide.
_PREFIX_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")

IOS_LEVELS = ["passive", "active", "time-sensitive"]


def _schema(d: dict, equipment: list[dict] | None = None) -> vol.Schema:
    fields = {
        vol.Required(CONF_PREFIX, default=d.get(CONF_PREFIX, "fio")): str,
        vol.Optional(CONF_MOBILE_DEVICES, default=list(d.get(CONF_MOBILE_DEVICES) or [])): _MOBILE,
        vol.Optional(CONF_MQTT_ROOT, default=d.get(CONF_MQTT_ROOT, "")): str,
        vol.Required(CONF_PH_SLOT, default=d.get(CONF_PH_SLOT, DEFAULT_PH_SLOT)): _SLOT,
        vol.Required(CONF_DIS_SLOT, default=d.get(CONF_DIS_SLOT, DEFAULT_DIS_SLOT)): _SLOT,
        vol.Required(CONF_NOTIFY_MEDIUM, default=d.get(CONF_NOTIFY_MEDIUM, False)): bool,
    }
    if equipment is not None:
        # Options de notification, dans Configurer seulement (les équipements doivent déjà exister).
        fields[vol.Optional(CONF_NOTIFY_DEVICES, default=list(d.get(CONF_NOTIFY_DEVICES) or []))] = (
            selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=equipment,
                    multiple=True,
                    mode=selector.SelectSelectorMode.LIST,
                )
            )
        )
        fields[vol.Required(CONF_NOTIFY_ON_START, default=d.get(CONF_NOTIFY_ON_START, True))] = bool
        fields[vol.Required(CONF_NOTIFY_ON_STOP, default=d.get(CONF_NOTIFY_ON_STOP, True))] = bool
        fields[vol.Required(CONF_NOTIFY_RECAP, default=d.get(CONF_NOTIFY_RECAP, True))] = bool
        fields[vol.Required(CONF_IOS_LEVEL, default=d.get(CONF_IOS_LEVEL, DEFAULT_IOS_LEVEL))] = (
            selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=IOS_LEVELS,
                    translation_key="ios_level",
                    mode=selector.SelectSelectorMode.DROPDOWN,
                )
            )
        )
    return vol.Schema(fields)


def _clean(user_input: dict) -> dict:
    """Préfixe en minuscules sans espace ni underscore final ; slots en entiers ; racine MQTT sans barres de bord."""
    data = dict(user_input)
    data[CONF_PREFIX] = (data.get(CONF_PREFIX) or "").strip().lower().rstrip("_")
    for key in (CONF_PH_SLOT, CONF_DIS_SLOT):
        data[key] = int(data[key])
    data[CONF_MQTT_ROOT] = (data.get(CONF_MQTT_ROOT) or "").strip().strip("/")
    data[CONF_MOBILE_DEVICES] = list(data.get(CONF_MOBILE_DEVICES) or [])
    if CONF_NOTIFY_DEVICES in data:
        data[CONF_NOTIFY_DEVICES] = list(data[CONF_NOTIFY_DEVICES] or [])
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
    VERSION = 2

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
    def _equipment(self, selected: list[str]) -> list[dict]:
        """Interrupteurs (switch) du contrôleur déjà connus de Home Assistant, plus ceux déjà choisis."""
        conf = {**self.config_entry.data, **self.config_entry.options}
        head = f"switch.{conf.get(CONF_PREFIX, 'fio')}_"
        items = {
            st.entity_id: st.attributes.get("friendly_name") or st.entity_id
            for st in self.hass.states.async_all("switch")
            if st.entity_id.startswith(head)
        }
        for entity_id in selected:
            items.setdefault(entity_id, entity_id)
        return [
            {"value": entity_id, "label": label}
            for entity_id, label in sorted(items.items(), key=lambda kv: kv[1].lower())
        ]

    async def async_step_init(self, user_input=None):
        errors = {}
        if user_input is not None:
            data = _clean(user_input)
            errors = _validate(data)
            if not errors:
                return self.async_create_entry(data=data)
        current = user_input or {**self.config_entry.data, **self.config_entry.options}
        equipment = self._equipment(list(current.get(CONF_NOTIFY_DEVICES) or []))
        return self.async_show_form(
            step_id="init", data_schema=_schema(current, equipment), errors=errors
        )
