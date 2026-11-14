import logging
from collections import deque
from datetime import timedelta
from time import monotonic

from homeassistant.const import EVENT_CALL_SERVICE
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_interval,
)
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
# Suivi en direct : la carte n'est créée qu'après ce délai de marche. iOS limite les démarrages d'activités
# par notification ; les marches très courtes (pompes doseuses) épuiseraient ce quota pour rien.
LIVE_START_DELAY = 60
# Barre de progression de la filtration : rafraîchie rarement, Apple et Google limitent les envois.
LIVE_REFRESH = timedelta(minutes=15)
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
    live_on = bool(rt.conf.get(CONF_NOTIFY_LIVE, False))
    filtration = rt.resolve("switch.{p}_io_flt_pmp")
    pending: dict = {}  # entité -> annulation du démarrage différé du suivi en direct
    refreshing: dict = {}  # entité -> annulation du rafraîchissement de la barre de progression
    # Commandes du forçage du firmware : elles agissent sur n'importe quel équipement.
    generic = tuple(f"{d}.{rt.prefix}_" for d in ("select", "number", "button"))
    commands: deque = deque(maxlen=20)

    def _tag(entity_id: str) -> str:
        return f"device_{entity_id.split('.', 1)[1]}"

    def _cancel(entity_id: str) -> None:
        for registry in (pending, refreshing):
            cancel = registry.pop(entity_id, None)
            if cancel:
                cancel()

    def _clear_live(entity_id: str) -> None:
        if live_on:
            hass.async_create_task(rt.async_clear_live(_tag(entity_id)))

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

    def _schedule_live(new, title: str, tag: str, icon, url: str) -> None:
        """Crée la carte en direct si l'équipement tourne toujours après LIVE_START_DELAY.

        Filtration avec une plage horaire connue : barre de progression rafraîchie toutes les 15 minutes.
        Sinon : chronomètre depuis le démarrage.
        """
        entity_id = new.entity_id

        def _still_running() -> bool:
            current = hass.states.get(entity_id)
            return current is not None and current.state == "on" and current.last_changed == new.last_changed

        async def _send(progress, update: bool) -> None:
            await rt.async_send_live(
                title,
                tag,
                started=new.last_changed,
                color=COLOR_OK,
                icon=icon,
                url=url,
                progress=progress,
                update=update,
            )

        async def _tick(_now) -> None:
            if not _still_running():
                _cancel(entity_id)
                return
            progress = rt.filtration_progress()
            if progress is not None:
                await _send(progress, True)

        async def _fire(_now) -> None:
            pending.pop(entity_id, None)
            if not _still_running():
                return
            progress = rt.filtration_progress() if entity_id == filtration else None
            await _send(progress, False)
            if progress is not None:
                refreshing[entity_id] = async_track_time_interval(hass, _tick, LIVE_REFRESH)

        pending[entity_id] = async_call_later(hass, LIVE_START_DELAY, _fire)

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
        tag = _tag(new.entity_id)
        icon = _icon(hass, new)
        # Toucher la notification ouvre la fiche de l'équipement.
        url = f"/?more-info-entity-id={new.entity_id}"
        if live_on and running:
            # Le suivi en direct remplace la notification de démarrage, après un délai de marche minimal.
            _schedule_live(new, title, tag, icon, url)
            return
        if live_on:
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
        if old is None or new is None or old.state == new.state:
            return
        # Un changement d'état annule le démarrage en attente et le rafraîchissement du suivi en direct.
        _cancel(new.entity_id)
        # Perte de lien : la carte en direct ne refléterait plus la réalité, on la retire.
        if new.state not in ("on", "off"):
            if old.state == "on":
                _clear_live(new.entity_id)
            return
        # Retour après indisponibilité (redémarrage) : pas une marche ou un arrêt, mais une carte restée
        # affichée pendant que l'équipement s'est arrêté serait périmée.
        if old.state not in ("on", "off"):
            _LOGGER.debug("Changement ignoré pour %s : %s -> %s", new.entity_id, old.state, new.state)
            if new.state == "off":
                _clear_live(new.entity_id)
            return
        running = new.state == "on"
        if not rt.conf.get(CONF_NOTIFY_ON_START if running else CONF_NOTIFY_ON_STOP, True):
            # Suivi en direct actif mais arrêts non notifiés : on retire quand même la carte.
            if not running:
                _clear_live(new.entity_id)
            return
        hass.async_create_task(_notify(old, new, running, _find(new.entity_id)))

    unsubs = [
        async_track_state_change_event(hass, entities, _changed),
        hass.bus.async_listen(EVENT_CALL_SERVICE, _on_call),
    ]

    def _unsub() -> None:
        for unsub in unsubs:
            unsub()
        for entity_id in {*pending, *refreshing}:
            _cancel(entity_id)

    return _unsub
