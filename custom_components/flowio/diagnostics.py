from homeassistant.components.diagnostics import async_redact_data

from .const import CONF_NOTIFY, DOMAIN

TO_REDACT = {CONF_NOTIFY}


async def async_get_config_entry_diagnostics(hass, entry):
    rt = hass.data[DOMAIN][entry.entry_id]
    states = {}
    for entity_id in rt.health.expected_entities():
        state = hass.states.get(entity_id)
        states[entity_id] = (
            None
            if state is None
            else {"state": state.state, "unit": state.attributes.get("unit_of_measurement")}
        )
    return {
        "config": async_redact_data({**entry.data, **entry.options}, TO_REDACT),
        "thresholds": dict(rt.values),
        "pumps": {
            key: {"history_ml": pump.history, "last_ml": pump.last_ml}
            for key, pump in rt.pumps.items()
        },
        "restarts": [t.isoformat() for t in rt.restarts],
        "expected_entities": states,
        "missing_entities": rt.health.missing_entities(),
    }
