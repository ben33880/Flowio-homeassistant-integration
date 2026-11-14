import logging
from collections import deque
from time import monotonic

from homeassistant.const import EVENT_CALL_SERVICE
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.util import dt as dt_util

from .const import (
    CONF_NOTIFY_DEVICES,
    CONF_NOTIFY_LIVE,
    CONF_NOTIFY_ON_START,
    CONF_NOTIFY_ON_STOP,
    DOMAIN,
)
from .runtime import COLOR_OFF, COLOR_OK, format_duration

_LOGGER = logging.getLogger(__name__)

DEVICE_CHANNEL = "Flow.io équipements"
COMMAND_WINDOW = 120  # secondes : délai max entre une commande Home Assistant et le changement d'état
RELIABLE_AFTER = 120  # secondes : une durée n'est fiable que si le démarrage a été observé après ce délai
# Services de l'intégration qui pilotent un équipement (refill_tank et reset_uptime n'en pilotent aucun).
EQUIPMENT_SERVICES = {"force_equipment", "release_override"}


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
        own = data.get("domain") == DOMAIN and data.get("service") in EQUIPMENT_SERVICES
        if targets or own or any(i.startswith(generic) for i in ids):
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
            # Durée fiable seulement si le démarrage a été observé après le chargement de l'intégration
            # (après un redémarrage, l'état restauré porte l'heure du redémarrage, pas celle du démarrage).
            reliable = (old.last_changed - rt.loaded_at).total_seconds() > RELIABLE_AFTER
            if reliable:
                title += f", durée {format_duration(new.last_changed - old.last_changed)}"
            else:
                title += ", durée inconnue"
        _LOGGER.debug("Notification %s : %s", new.entity_id, title)
        tag = f"device_{new.entity_id.split('.', 1)[1]}"
        icon = _icon(hass, new)
        # Toucher la notification ouvre la fiche de l'équipement.
        url = f"/?more-info-entity-id={new.entity_id}"
        live = rt.conf.get(CONF_NOTIFY_LIVE, False)
        if live and running:
            # Le suivi en direct remplace la notification de démarrage.
            await rt.async_send_live(title, tag, started=new.last_changed, color=COLOR_OK, icon=icon, url=url)
            return
        if live:
            await rt.async_clear_live(tag)
        await rt.async_send(
            title,
            "",
            tag,
            color=COLOR_OK if running else COLOR_OFF,
            icon=icon,
            url=url,
            channel=DEVICE_CHANNEL,
            recap=True,
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
        running = new.state == "on"
        if not rt.conf.get(CONF_NOTIFY_ON_START if running else CONF_NOTIFY_ON_STOP, True):
            # Suivi en direct actif mais arrêts non notifiés : on retire quand même la carte.
            if not running and rt.conf.get(CONF_NOTIFY_LIVE, False):
                hass.async_create_task(rt.async_clear_live(f"device_{new.entity_id.split('.', 1)[1]}"))
            return
        hass.async_create_task(_notify(old, new, running, _find(new.entity_id)))

    unsubs = [
        async_track_state_change_event(hass, entities, _changed),
        hass.bus.async_listen(EVENT_CALL_SERVICE, _on_call),
    ]

    def _unsub() -> None:
        for unsub in unsubs:
            unsub()

    return _unsub
