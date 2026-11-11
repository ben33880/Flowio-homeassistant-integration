import math

GOOD, MEDIUM, BAD = "good", "medium", "bad"
_ORDER = {GOOD: 0, MEDIUM: 1, BAD: 2}


def as_float(state) -> float | None:
    if state is None:
        return None
    try:
        value = float(state.state)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def grade(values: dict, prefix: str, value: float) -> str:
    """Bornes inclusives : bon dans [good_min, good_max], moyen dans [mid_min, mid_max], sinon mauvais."""
    if values[f"{prefix}_good_min"] <= value <= values[f"{prefix}_good_max"]:
        return GOOD
    if values[f"{prefix}_mid_min"] <= value <= values[f"{prefix}_mid_max"]:
        return MEDIUM
    return BAD


def worst(grades: list[str]) -> str | None:
    return max(grades, key=_ORDER.get) if grades else None
