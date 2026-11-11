import asyncio
import logging

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .quality import as_float
from .runtime import FlowioRuntime

_LOGGER = logging.getLogger(__name__)

CONFIRM_TIMEOUT = 10.0  # secondes d'attente du retour d'état du firmware
MAX_FORCE_MINUTES = 120

# Boutons publiés par le firmware (docs de Flow.io-Waveshare et des cartes).
REFILL_BUTTONS = {"ph": "pd_refill_ph", "disinfection": "pd_refill_chl"}
RESET_BUTTONS = {
    "filtration": "pd_reset_upt_flt",
    "ph": "pd_reset_upt_ph",
    "disinfection": "pd_reset_upt_chl",
    "fill": "pd_reset_upt_fill",
    "chlorine_generator": "pd_reset_upt_chl_gen",
    "all": "pd_reset_upt_all",
}
# Compteurs de marche suivis par l'intégration (volumes injectés) concernés par une remise à zéro.
RESET_PUMPS = {"ph": ["ph"], "disinfection": ["dis"], "all": ["ph", "dis"]}

_PREFIX = {vol.Optional("prefix"): cv.string}
_CONFIRM = {vol.Required("confirm"): vol.All(cv.boolean, vol.Equal(True))}

FORCE_SCHEMA = vol.Schema(
    {
        **_PREFIX,
        vol.Required("target"): cv.string,
        vol.Required("state"): vol.In(["on", "off"]),
        vol.Required("minutes"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    }
)
RELEASE_SCHEMA = vol.Schema({**_PREFIX, vol.Optional("target"): cv.string})
REFILL_SCHEMA = vol.Schema({**_PREFIX, vol.Required("tank"): vol.In(list(REFILL_BUTTONS)), **_CONFIRM})
RESET_SCHEMA = vol.Schema({**_PREFIX, vol.Required("device"): vol.In(list(RESET_BUTTONS)), **_CONFIRM})


def _runtime(hass: HomeAssistant, call: ServiceCall) -> FlowioRuntime:
    runtimes = [r for r in hass.data.get(DOMAIN, {}).values() if isinstance(r, FlowioRuntime)]
    prefix = call.data.get("prefix")
    if prefix:
        runtimes = [r for r in runtimes if r.prefix == prefix]
    if len(runtimes) != 1:
        raise ServiceValidationError(
            "Aucune installation Flow.io trouvée, ou plusieurs : précisez le champ « prefix »."
        )
    return runtimes[0]


def _available(hass: HomeAssistant, entity_id: str):
    state = hass.states.get(entity_id)
    if state is None:
        raise ServiceValidationError(f"Entité introuvable : {entity_id}.")
    if state.state == "unavailable":
        raise HomeAssistantError(f"{entity_id} est indisponible (contrôleur hors ligne ?). Aucune commande envoyée.")
    return state


async def _wait_for(hass: HomeAssistant, entity_id: str, predicate) -> bool:
    end = hass.loop.time() + CONFIRM_TIMEOUT
    while hass.loop.time() < end:
        state = hass.states.get(entity_id)
        if state is not None and predicate(state):
            return True
        await asyncio.sleep(0.25)
    return False


async def _select_target(hass: HomeAssistant, rt: FlowioRuntime, target: str) -> None:
    entity = f"select.{rt.prefix}_pdm_ovr_target"
    state = _available(hass, entity)
    options = state.attributes.get("options") or []
    if target not in options:
        raise ServiceValidationError(
            f"Équipement « {target} » inconnu. Choix publiés par le firmware : {', '.join(options) or 'aucun'}."
        )
    if state.state != target:
        await hass.services.async_call(
            "select", "select_option", {"entity_id": entity, "option": target}, blocking=True
        )
        if not await _wait_for(hass, entity, lambda s: s.state == target):
            raise HomeAssistantError(
                "Le firmware n'a pas confirmé la sélection de l'équipement. Aucune commande envoyée."
            )


async def _press(hass: HomeAssistant, entity_id: str) -> None:
    _available(hass, entity_id)
    await hass.services.async_call("button", "press", {"entity_id": entity_id}, blocking=True)


def async_register_services(hass: HomeAssistant) -> None:
    async def force_equipment(call: ServiceCall) -> None:
        rt = _runtime(hass, call)
        target, state, minutes = call.data["target"], call.data["state"], call.data["minutes"]
        duration_entity = f"number.{rt.prefix}_pdm_ovr_min"
        duration = _available(hass, duration_entity)
        cap = MAX_FORCE_MINUTES
        limit = as_float(type("S", (), {"state": duration.attributes.get("max")})())
        if limit is not None:
            cap = min(cap, limit)
        if minutes > cap:
            raise ServiceValidationError(f"Durée limitée à {cap:g} min (reçu : {minutes}).")

        await _select_target(hass, rt, target)

        current = as_float(hass.states.get(duration_entity))
        if current != minutes:
            await hass.services.async_call(
                "number", "set_value", {"entity_id": duration_entity, "value": minutes}, blocking=True
            )
            if not await _wait_for(hass, duration_entity, lambda s: as_float(s) == minutes):
                raise HomeAssistantError(
                    "Le firmware n'a pas confirmé la durée du forçage. Aucune commande envoyée."
                )

        status = hass.states.get(f"sensor.{rt.prefix}_pdm_ovr_state")
        if status is not None and status.attributes.get("override_available") is False:
            raise HomeAssistantError("Le forçage n'est pas disponible pour cet équipement (firmware).")

        _LOGGER.info("Forçage %s : %s pendant %s min", target, state, minutes)
        await _press(hass, f"button.{rt.prefix}_pdm_ovr_{state}")

    async def release_override(call: ServiceCall) -> None:
        rt = _runtime(hass, call)
        if call.data.get("target"):
            await _select_target(hass, rt, call.data["target"])
        _LOGGER.info("Libération du forçage %s", call.data.get("target", "(sélection courante)"))
        await _press(hass, f"button.{rt.prefix}_pdm_ovr_release")

    async def refill_tank(call: ServiceCall) -> None:
        rt = _runtime(hass, call)
        _LOGGER.info("Remplissage de cuve confirmé : %s", call.data["tank"])
        await _press(hass, f"button.{rt.prefix}_{REFILL_BUTTONS[call.data['tank']]}")

    async def reset_uptime(call: ServiceCall) -> None:
        rt = _runtime(hass, call)
        device = call.data["device"]
        # Évite que la remise à zéro soit comptée comme un jour complet dans l'autonomie des cuves.
        for pump in RESET_PUMPS.get(device, []):
            rt.pumps[pump].last_ml = None
        _LOGGER.info("Remise à zéro du compteur de marche : %s", device)
        await _press(hass, f"button.{rt.prefix}_{RESET_BUTTONS[device]}")

    hass.services.async_register(DOMAIN, "force_equipment", force_equipment, schema=FORCE_SCHEMA)
    hass.services.async_register(DOMAIN, "release_override", release_override, schema=RELEASE_SCHEMA)
    hass.services.async_register(DOMAIN, "refill_tank", refill_tank, schema=REFILL_SCHEMA)
    hass.services.async_register(DOMAIN, "reset_uptime", reset_uptime, schema=RESET_SCHEMA)
