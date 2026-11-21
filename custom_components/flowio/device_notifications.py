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
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    CONF_NOTIFY_DEVICES,
    CONF_NOTIFY_LIVE,
    CONF_NOTIFY_LIVE_REFRESH,
    CONF_NOTIFY_ON_START,
    CONF_NOTIFY_ON_STOP,
    DEFAULT_LIVE_REFRESH,
    DOMAIN,
)
from .runtime import COLOR_OFF, COLOR_OK, format_duration
from .localization import firmware_name, localize

_LOGGER = logging.getLogger(__name__)

# Instant où ce module est importé : au démarrage de Home Assistant, pas à chaque rechargement de
# l'intégration (enregistrer les options recharge l'intégration mais ne réimporte pas le module).
PROCESS_START = dt_util.utcnow()

COMMAND_WINDOW = 120  # secondes : délai max entre une commande Home Assistant et le changement d'état
RELIABLE_AFTER = 120  # secondes : une durée n'est fiable que si le démarrage a eu lieu après ce délai de démarrage
# Suivi en direct (filtration seulement) : la carte n'est créée qu'après ce délai de marche, car iOS limite
# les démarrages d'activités par notification.
LIVE_START_DELAY = 60
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
        return user.name if user and user.name else localize(hass, "notifications.equipment.user")
    if context.parent_id:
        return localize(hass, "notifications.equipment.automation")
    return "Home Assistant"


def async_setup_device_notifications(rt):
    """Notifie les changements on/off des équipements choisis ; renvoie la fonction de désabonnement."""
    entities = [e for e in (rt.conf.get(CONF_NOTIFY_DEVICES) or []) if isinstance(e, str)]
    if not entities:
        return lambda: None

    hass = rt.hass
    watched = set(entities)
    filtration = rt.resolve("switch.{p}_io_flt_pmp")
    # Le suivi en direct ne concerne que la filtration ; les autres équipements gardent leurs notifications.
    live_on = bool(rt.conf.get(CONF_NOTIFY_LIVE, False)) and filtration in watched
    # Barre de progression de la filtration : intervalle réglable, Apple et Google limitent les envois.
    try:
        refresh = timedelta(minutes=max(1, int(rt.conf.get(CONF_NOTIFY_LIVE_REFRESH, DEFAULT_LIVE_REFRESH))))
    except (TypeError, ValueError):
        refresh = timedelta(minutes=DEFAULT_LIVE_REFRESH)
    pending: dict = {}  # entité -> annulation du démarrage différé du suivi en direct
    refreshing: dict = {}  # entité -> annulation du rafraîchissement de la barre de progression
    # Commandes du forçage du firmware : elles agissent sur n'importe quel équipement.
    generic = tuple(f"{d}.{rt.prefix}_" for d in ("select", "number", "button"))
    commands: deque = deque(maxlen=20)
    # Heure et auteur du vrai démarrage, conservés au redémarrage : last_changed repart de zéro à ce moment.
    store = Store(hass, 1, f"{DOMAIN}.{rt.entry.entry_id}.equipment_starts")
    starts: dict = {}
    closed = False

    def _tag(entity_id: str) -> str:
        return f"device_{entity_id.split('.', 1)[1]}"

    def _remember(entity_id: str, start, author: str) -> None:
        starts[entity_id] = {"start": start.isoformat(), "author": author}
        store.async_delay_save(lambda: starts, 1)

    def _forget(entity_id: str) -> None:
        if starts.pop(entity_id, None) is not None:
            store.async_delay_save(lambda: starts, 1)

    def _started(entity_id: str):
        """(heure, auteur) du démarrage en cours, ou None."""
        saved = starts.get(entity_id)
        start = dt_util.parse_datetime(saved.get("start", "")) if isinstance(saved, dict) else None
        if start is None:
            return None
        return start, saved.get("author") or localize(hass, "notifications.equipment.controller")

    def _is_live(entity_id: str) -> bool:
        return live_on and entity_id == filtration

    def _cancel(entity_id: str) -> None:
        for registry in (pending, refreshing):
            cancel = registry.pop(entity_id, None)
            if cancel:
                cancel()

    def _clear_live(entity_id: str) -> None:
        if _is_live(entity_id):
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

    def _schedule_live(new, start) -> None:
        """Crée la carte en direct de la filtration si elle tourne toujours après LIVE_START_DELAY.

        Plage horaire connue : barre de progression rafraîchie à l'intervalle choisi. Sinon : chronomètre
        depuis le démarrage. `start` est l'heure du vrai démarrage, qui peut précéder new.last_changed.
        """
        entity_id = new.entity_id
        tag, icon = _tag(entity_id), _icon(hass, new)
        url = f"/?more-info-entity-id={entity_id}"
        name = firmware_name(hass, entity_id, new.attributes.get("friendly_name") or entity_id)
        title = localize(
            hass,
            "notifications.equipment.running_since",
            name=name,
            time=dt_util.as_local(start).strftime("%H:%M"),
        )

        def _still_running() -> bool:
            current = hass.states.get(entity_id)
            return current is not None and current.state == "on" and current.last_changed == new.last_changed

        async def _send(progress, update: bool) -> None:
            await rt.async_send_live(
                title,
                tag,
                started=start,
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
            progress = rt.filtration_progress()
            await _send(progress, False)
            # La carte en direct remplace la notification de démarrage envoyée immédiatement.
            if rt.conf.get(CONF_NOTIFY_ON_START, True):
                await rt.async_clear(tag)
            if progress is not None:
                refreshing[entity_id] = async_track_time_interval(hass, _tick, refresh)

        _LOGGER.debug(
            "Suivi en direct programmé pour %s dans %s secondes", entity_id, LIVE_START_DELAY
        )
        pending[entity_id] = async_call_later(hass, LIVE_START_DELAY, _fire)

    def _equipment_title(entity_id: str, state, running: bool, author: str, duration_start=None) -> str:
        name = firmware_name(
            hass, entity_id, state.attributes.get("friendly_name") or entity_id
        )
        at = dt_util.as_local(state.last_changed).strftime("%H:%M")
        key = "notifications.equipment.start" if running else "notifications.equipment.stop"
        title = localize(hass, key, name=name, time=at, author=author)
        if not running:
            if duration_start is None:
                title += ", " + localize(
                    hass, "notifications.equipment.duration_unknown"
                )
            else:
                title += ", " + localize(
                    hass,
                    "notifications.equipment.duration",
                    duration=format_duration(state.last_changed - duration_start, hass),
                )
        return title

    async def _notify(old, new, running: bool, context) -> None:
        entity_id = new.entity_id
        who = await _who(hass, context) if context else localize(hass, "notifications.equipment.controller")
        saved = None if running else _started(entity_id)
        if running:
            _remember(entity_id, new.last_changed, who)
            duration_start = None
        elif saved and saved[0] <= new.last_changed:
            # Heure réelle du démarrage, même si Home Assistant a redémarré depuis.
            duration_start = saved[0]
        else:
            # Durée fiable seulement si le démarrage a eu lieu bien après le démarrage de Home Assistant.
            reliable = (old.last_changed - PROCESS_START).total_seconds() > RELIABLE_AFTER
            duration_start = old.last_changed if reliable else None
        if not running:
            _forget(entity_id)
        title = _equipment_title(entity_id, new, running, who, duration_start)
        _LOGGER.debug("Notification %s : %s", entity_id, title)
        tag = _tag(entity_id)
        live = _is_live(entity_id)
        if live and running:
            # La carte en direct remplace cette notification après un délai de marche minimal.
            _schedule_live(new, new.last_changed)
            if not rt.conf.get(CONF_NOTIFY_ON_START, True):
                return
        if live and not running:
            await rt.async_clear_live(tag)
        await rt.async_send(
            title,
            "",
            tag,
            color=COLOR_OK if running else COLOR_OFF,
            icon=_icon(hass, new),
            # Toucher la notification ouvre la fiche de l'équipement.
            url=f"/?more-info-entity-id={entity_id}",
            channel=localize(hass, "notifications.channels.equipment"),
            recap=True,
        )

    def _resume(state) -> None:
        """Reprend le suivi en direct d'une filtration déjà en marche (redémarrage ou rechargement)."""
        saved = _started(state.entity_id)
        if saved:
            start = saved[0]
        else:
            start = state.last_changed
            _remember(state.entity_id, start, localize(hass, "notifications.equipment.controller"))
        _schedule_live(state, start)

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
                _forget(new.entity_id)
                _clear_live(new.entity_id)
            elif _is_live(new.entity_id):
                # Redémarrage pendant la marche : le suivi en direct reprend sans notification de démarrage.
                _resume(new)
            return
        running = new.state == "on"
        live = _is_live(new.entity_id)
        if not rt.conf.get(CONF_NOTIFY_ON_START if running else CONF_NOTIFY_ON_STOP, True) and not (
            running and live
        ):
            # Suivi en direct actif mais arrêts non notifiés : on retire quand même la carte.
            if not running:
                _forget(new.entity_id)
                _clear_live(new.entity_id)
            return
        hass.async_create_task(_notify(old, new, running, _find(new.entity_id)))

    unsubs = [
        async_track_state_change_event(hass, entities, _changed),
        hass.bus.async_listen(EVENT_CALL_SERVICE, _on_call),
    ]

    async def _restore() -> None:
        # Une reprise après redémarrage/rechargement ne produit pas de transition off -> on.
        # Reprogrammer explicitement le suivi si la filtration était déjà en marche.
        saved = await store.async_load()
        if closed:
            return
        if isinstance(saved, dict):
            starts.update(saved)
        for entity_id in list(starts):
            state = hass.states.get(entity_id)
            if state is not None and state.state == "off":
                _forget(entity_id)
        current = hass.states.get(filtration)
        if current is not None and current.state == "on" and live_on:
            _resume(current)

    hass.async_create_task(_restore())

    def _unsub() -> None:
        nonlocal closed
        closed = True
        for unsub in unsubs:
            unsub()
        for entity_id in {*pending, *refreshing}:
            _cancel(entity_id)

    return _unsub
