from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError

from .const import ALERTS, DOMAIN
from .quality import as_float
from .runtime import REFILL_ALERTS, FlowioRuntime

EVENT = "mobile_app_notification_action"
SNOOZE_HOURS = 24

_NAMES = {a.key: a.name for a in ALERTS}
_TANK_SOURCES = {"ph": "sensor.{p}_data_{ph_pct}", "disinfection": "sensor.{p}_data_{dis_pct}"}


def async_setup_actions(rt: FlowioRuntime):
    """Écoute les boutons des notifications ; retourne la fonction de désabonnement."""
    hass = rt.hass
    head = f"flowio_{rt.prefix}_"

    async def snooze(key: str) -> None:
        rt.snooze(key, SNOOZE_HOURS)
        await rt.async_send(f"🔕 {_NAMES[key]}", f"Notifications reportées de {SNOOZE_HOURS} h.", key)

    async def refill(key: str) -> None:
        tank = REFILL_ALERTS[key]
        level = as_float(hass.states.get(rt.resolve(_TANK_SOURCES[tank])))
        # Garde-fou : un appui accidentel ne réinitialise pas une cuve dont le niveau n'est pas bas.
        if level is None or level >= float(rt.values["tank_min"]):
            await rt.async_send(
                f"ℹ️ {_NAMES[key]}", "Le niveau n'est pas bas : aucune action envoyée.", key
            )
            return
        try:
            await hass.services.async_call(
                DOMAIN,
                "refill_tank",
                {"prefix": rt.prefix, "tank": tank, "confirm": True},
                blocking=True,
            )
        except HomeAssistantError as err:
            await rt.async_send(f"⚠️ {_NAMES[key]}", f"Échec : {err}", key)
            return
        await rt.async_send(f"✅ {_NAMES[key]}", "Remplissage signalé au firmware.", key)

    @callback
    def handle(event) -> None:
        action = str(event.data.get("action", ""))
        if not action.startswith(head):
            return
        verb, _, key = action[len(head):].partition("_")
        if key not in _NAMES:
            return
        if verb == "snooze":
            hass.async_create_task(snooze(key))
        elif verb == "refill" and key in REFILL_ALERTS:
            hass.async_create_task(refill(key))

    return hass.bus.async_listen(EVENT, handle)
