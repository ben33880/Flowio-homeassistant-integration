from homeassistant.core import callback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.util import dt as dt_util

from .const import CONF_NOTIFY_DEVICES
from .runtime import COLOR_OFF, COLOR_OK, format_duration

DEVICE_CHANNEL = "Flow.io équipements"


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
        if old.state not in ("on", "off") or new.state not in ("on", "off") or old.state == new.state:
            return
        running = new.state == "on"
        name = new.attributes.get("friendly_name") or new.entity_id
        at = dt_util.as_local(new.last_changed).strftime("%H:%M")
        previous = format_duration(new.last_changed - old.last_changed)
        if running:
            title = f"🟢 {name}"
            message = f"En marche depuis {at}\n⏸️ À l'arrêt depuis {previous}"
        else:
            title = f"⚪ {name}"
            message = f"Arrêté à {at}\n⏱️ A fonctionné {previous}"
        style = {
            "color": COLOR_OK if running else COLOR_OFF,
            "notification_icon": new.attributes.get("icon") or "mdi:power",
            "channel": DEVICE_CHANNEL,
        }
        if running:
            # Android : affiche un chronomètre du temps de marche dans la notification.
            style.update({"chronometer": True, "when": int(new.last_changed.timestamp())})
        tag = f"device_{new.entity_id.split('.', 1)[1]}"
        rt.hass.async_create_task(
            rt.async_send(title, message, tag, style=style, context=True, about=new.entity_id)
        )

    return async_track_state_change_event(rt.hass, entities, _changed)
