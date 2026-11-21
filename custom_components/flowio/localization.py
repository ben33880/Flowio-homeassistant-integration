import json
from functools import cache
from pathlib import Path

HERE = Path(__file__).parent


@cache
def _translations(selected_language: str) -> dict:
    path = HERE / "translations" / f"{selected_language}.json"
    if not path.is_file():
        path = HERE / "translations" / "en.json"
    return json.loads(path.read_text(encoding="utf-8"))


def language(hass) -> str:
    configured = getattr(getattr(hass, "config", None), "language", "en") or "en"
    return str(configured).lower().split("-", 1)[0]


def localize(hass, key: str, **values) -> str:
    data = _translations(language(hass))
    for part in key.split("."):
        if not isinstance(data, dict) or part not in data:
            data = _translations("en")
            for fallback in key.split("."):
                data = data[fallback]
            return data.format(**values)
        data = data[part]
    return data.format(**values)


def firmware_name(hass, entity_id: str, name: str) -> str:
    suffix = entity_id.partition(".")[2]
    translations = _translations(language(hass))
    english = _translations("en")
    entities = english.get("card", {}).get("firmware_entity_names", {})
    localized = translations.get("card", {}).get("firmware_entity_names", {})
    key = next((key for key in entities if suffix.endswith(key)), None)
    if not key:
        return name
    original = entities[key]
    translated = localized.get(key, original)
    if name.casefold() == original.casefold():
        return translated
    marker = f" {original}"
    if name.casefold().endswith(marker.casefold()):
        prefix = name[:-len(marker)]
        if prefix.casefold().startswith("flow.io"):
            return prefix + " " + translated
    return name


def alert_name(hass, key: str, fallback: str) -> str:
    names = _translations(language(hass)).get("notifications", {}).get("alert_names", {})
    return names.get(key, fallback)
