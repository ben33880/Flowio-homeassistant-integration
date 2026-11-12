from homeassistant.core import callback
from homeassistant.helpers.event import async_track_state_change_event

from .const import CONF_NOTIFY_DEVICES

_STATES = {"on": "en marche", "off": "arrêté"}


def async_setup_device_notifications(rt):
    """Notifie les changements on/off des équipements choisis ; renvoie la fonction de désabonnement."""
    entities = [e for e in (rt.conf.get(CONF_NOTIFY_DEVICES) or []) if isinstance(e, str)]
    if not entities:
        return lambda: None

    @callback
    def _changed(event) -> None:
        old, new = event.data.get("old_state"), event.data.get("new_state")
        # Les passages par unavailable/unknown (redémarrage, perte de lien) ne sont pas des changements d'état.
        if old is None or new is None:
            return
        if old.state not in _STATES or new.state not in _STATES or old.state == new.state:
            return
        name = new.attributes.get("friendly_name") or new.entity_id
        tag = f"device_{new.entity_id.split('.', 1)[1]}"
        rt.hass.async_create_task(
            rt.async_send(f"Flow.io : {name}", f"{name} : {_STATES[new.state]}.", tag)
        )

    return async_track_state_change_event(rt.hass, entities, _changed)
