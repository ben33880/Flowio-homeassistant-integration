import logging
from collections import deque
from time import monotonic

from homeassistant.const import EVENT_CALL_SERVICE
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.util import dt as dt_util

from .const import CONF_NOTIFY_DEVICES, DOMAIN
from .runtime import COLOR_OFF, COLOR_OK, format_duration

_LOGGER = logging.getLogger(__name__)

DEVICE_CHANNEL = "Flow.io équipements"
COMMAND_WINDOW = 120  # secondes : délai max entre une commande Home Assistant et le changement d'état


def _icon(hass, state) -> str | None:
    """Icône de l'entité : celle de l'état, sinon celle du registre (personnalisée ou publiée par MQTT)."""
    icon = state.attributes.get("icon")
    if icon:
        return icon
    entry = er.async_get(hass).async_get(state.entity_id)
    if entry:
        return entry.icon or entry.original_icon
    return None


async def _who(hass, context) -> str:
    if context.user_id:
        user = await hass.auth.async_get_user(context.user_id)
        return user.name if user and user.name else "un utilisateur"
    if context.parent_id:
        return "une automatisation ou un script"
    return "Home Assistant"


def async_setup_device_notifications(rt):
    """Notifie les changements on/off des équipements choisis ; renvoie la fonction de désabonnement."""
    entities = [e for e in (rt.conf.get(CONF_NOTIFY_DEVICES) or []) if isinstance(e, str)]
    if not entities:
        return lambda: None

    hass = rt.hass
    watched = set(entities)
    # Commandes du forçage du firmware : elles agissent sur n'importe quel équipement.
    generic = tuple(f"{d}.{rt.prefix}_" for d in ("select", "number", "button"))
    commands: deque = deque(maxlen=20)

    @callback
    def _on_call(event) -> None:
        data = event.data
        ids = (data.get("service_data") or {}).get("entity_id") or []
        if isinstance(ids, str):
            ids = [ids]
        ids = {i for i in ids if isinstance(i, str)}
        targets = ids & watched
        if targets or data.get("domain") == DOMAIN or any(i.startswith(generic) for i in ids):
            commands.append((monotonic(), targets, event.context))

    def _find(entity_id: str):
        """Contexte de la commande Home Assistant la plus récente qui explique le changement."""
        now, fallback = monotonic(), None
        for stamp, targets, context in reversed(commands):
            if now - stamp > COMMAND_WINDOW:
                break
            if entity_id in targets:
                return context
            if not targets and fallback is None:
                fallback = context
        return fallback

    async def _notify(old, new, running: bool, context) -> None:
        name = new.attributes.get("friendly_name") or new.entity_id
        who = await _who(hass, context) if context else "le contrôleur"
        at = dt_util.as_local(new.last_changed).strftime("%H:%M")
        # Première ligne (titre) : équipement, action, heure, auteur, et durée à l'arrêt seulement.
        title = f"{name} : {'démarrage' if running else 'arrêt'} à {at} par {who}"
        if not running:
            title += f", durée {format_duration(new.last_changed - old.last_changed)}"
        # Toucher la notification ouvre la fiche de l'équipement (Android : clickAction, iOS : url).
        target = f"/?more-info-entity-id={new.entity_id}"
        style = {
            "color": COLOR_OK if running else COLOR_OFF,
            "channel": DEVICE_CHANNEL,
            "clickAction": target,
            "url": target,
            "alert_once": True,
        }
        icon = _icon(hass, new)
        if icon:
            style["notification_icon"] = icon
        _LOGGER.debug("Notification %s : %s", new.entity_id, title)
        # Corps : récapitulatif pH/ORP, eau/air, pression.
        await rt.async_send(
            title,
            "",
            f"device_{new.entity_id.split('.', 1)[1]}",
            style=style,
            context=True,
        )

    @callback
    def _changed(event) -> None:
        old, new = event.data.get("old_state"), event.data.get("new_state")
        # Les passages par unavailable/unknown (redémarrage, perte de lien) ne sont pas des changements d'état.
        if old is None or new is None:
            return
        if old.state not in ("on", "off") or new.state not in ("on", "off") or old.state == new.state:
            _LOGGER.debug("Changement ignoré pour %s : %s -> %s", new.entity_id, old.state, new.state)
            return
        hass.async_create_task(_notify(old, new, new.state == "on", _find(new.entity_id)))

    unsubs = [
        async_track_state_change_event(hass, entities, _changed),
        hass.bus.async_listen(EVENT_CALL_SERVICE, _on_call),
    ]

    def _unsub() -> None:
        for unsub in unsubs:
            unsub()

    return _unsub
