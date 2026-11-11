import json
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN, JS_FILE, PLATFORMS, URL_BASE
from .runtime import FlowioRuntime
from .services import async_register_services

HERE = Path(__file__).parent


def _frontend_info():
    js = HERE / "frontend" / JS_FILE
    if not js.is_file():
        return None
    version = json.loads((HERE / "manifest.json").read_text())["version"]
    return version


async def async_setup(hass: HomeAssistant, config) -> bool:
    hass.data.setdefault(DOMAIN, {})
    async_register_services(hass)
    version = await hass.async_add_executor_job(_frontend_info)
    if version is None:
        return True
    await hass.http.async_register_static_paths(
        [StaticPathConfig(URL_BASE, str(HERE / "frontend"), cache_headers=False)]
    )
    add_extra_js_url(hass, f"{URL_BASE}/{JS_FILE}?v={version}")
    return True


async def async_setup_entry(hass: HomeAssistant, entry) -> bool:
    rt = FlowioRuntime(hass, entry)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = rt
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    rt.health.start()
    entry.async_on_unload(rt.health.stop)
    entry.async_on_unload(entry.add_update_listener(_reload))
    return True


async def async_unload_entry(hass: HomeAssistant, entry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return ok


async def _reload(hass: HomeAssistant, entry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
