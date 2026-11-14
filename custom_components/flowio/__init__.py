import json
from pathlib import Path

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from .const import CONF_MQTT_ROOT, DOMAIN, JS_FILE, PLATFORMS, THRESHOLDS, URL_BASE
from .device_notifications import async_setup_device_notifications
from .notification_actions import async_setup_actions
from .runtime import FlowioRuntime
from .services import async_register_services

HERE = Path(__file__).parent


def _frontend_info():
    js = HERE / "frontend" / JS_FILE
    if not js.is_file():
        return None
    version = json.loads((HERE / "manifest.json").read_text())["version"]
    return version


def _installation(rt: FlowioRuntime) -> dict:
    """Réglages partagés et identifiants réels, y compris après renommage."""
    registry = er.async_get(rt.hass)
    entities = {
        key: registry.async_get_entity_id("sensor", DOMAIN, f"{rt.prefix}_{key}")
        for key in (
            "ph_quality", "orp_quality", "water_quality", "ph_injected",
            "dis_injected", "ph_autonomy", "dis_autonomy",
        )
    }
    entities.update({
        t.key: registry.async_get_entity_id("number", DOMAIN, f"{rt.prefix}_threshold_{t.key}")
        for t in THRESHOLDS
    })
    return {
        "prefix": rt.prefix,
        "ph_slot": rt.ph_slot,
        "disinfection_slot": rt.dis_slot,
        "mqtt_root": (rt.conf.get(CONF_MQTT_ROOT) or "").strip().strip("/"),
        "thresholds": dict(rt.values),
        "entities": entities,
    }


@websocket_api.websocket_command({vol.Required("type"): "flowio/config"})
@callback
def _ws_config(hass: HomeAssistant, connection, msg) -> None:
    runtimes = [v for v in hass.data.get(DOMAIN, {}).values() if isinstance(v, FlowioRuntime)]
    connection.send_result(msg["id"], {"installations": [_installation(rt) for rt in runtimes]})


async def async_setup(hass: HomeAssistant, config) -> bool:
    hass.data.setdefault(DOMAIN, {})
    async_register_services(hass)
    websocket_api.async_register_command(hass, _ws_config)
    version = await hass.async_add_executor_job(_frontend_info)
    if version is None:
        return True
    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL_BASE, str(HERE / "frontend"), cache_headers=False)]
    )
    add_extra_js_url(hass, f"{URL_BASE}/{JS_FILE}?v={version}")
    return True


async def async_migrate_entry(hass: HomeAssistant, entry) -> bool:
    """Version 2 : le service de notification est remplacé par une liste d'appareils mobiles."""
    if entry.version < 2:
        data = {k: v for k, v in entry.data.items() if k != "notify_service"}
        options = {k: v for k, v in entry.options.items() if k != "notify_service"}
        hass.config_entries.async_update_entry(entry, data=data, options=options, version=2)
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    rt = FlowioRuntime(hass, entry)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = rt
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    rt.health.start()
    entry.async_on_unload(rt.health.stop)
    entry.async_on_unload(async_setup_actions(rt))
    entry.async_on_unload(async_setup_device_notifications(rt))
    entry.async_on_unload(entry.add_update_listener(_reload))
    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return ok


async def _reload(hass: HomeAssistant, entry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
