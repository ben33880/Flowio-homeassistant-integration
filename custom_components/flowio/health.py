from datetime import timedelta

from homeassistant.core import callback
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import ALERTS, CONF_NOTIFY, DOMAIN

STARTUP_DELAY = 120  # secondes : laisse le temps à MQTT et aux notifications de se charger
CHECK_INTERVAL = timedelta(minutes=15)
RESTART_WINDOW = timedelta(hours=24)
RESTART_LIMIT = 3
MAX_LISTED = 10

# Entités lues par l'intégration en plus de celles des alertes.
EXTRA_ENTITIES = [
    "sensor.{p}_data_{ph_rt}",
    "sensor.{p}_data_{dis_rt}",
    "number.{p}_pd1_flow",
    "number.{p}_pd2_flow",
    "sensor.{p}_sys_upt_mn",
]


class HealthMonitor:
    """Vérifie la cohérence de l'installation et publie des réparations Home Assistant."""

    def __init__(self, rt):
        self._rt = rt
        self._unsubs = []
        eid = rt.entry.entry_id
        self._ids = {
            key: f"{key}_{eid}"
            for key in ("missing_entities", "notify_service_missing", "frequent_restarts")
        }

    def expected_entities(self) -> list[str]:
        templates = [a.source for a in ALERTS]
        templates += [a.require_on for a in ALERTS if a.require_on]
        templates += EXTRA_ENTITIES
        return sorted({self._rt.resolve(t) for t in templates})

    def missing_entities(self) -> list[str]:
        return [e for e in self.expected_entities() if self._rt.hass.states.get(e) is None]

    def recent_restarts(self) -> list:
        now = dt_util.utcnow()
        return [t for t in self._rt.restarts if now - t < RESTART_WINDOW]

    def start(self) -> None:
        hass = self._rt.hass
        self._unsubs.append(async_call_later(hass, STARTUP_DELAY, self.evaluate))
        self._unsubs.append(async_track_time_interval(hass, self.evaluate, CHECK_INTERVAL))

    def stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        for key in self._ids:
            self._issue(key, False)

    def _issue(self, key, active, fixable=False, placeholders=None, data=None) -> None:
        hass, issue_id = self._rt.hass, self._ids[key]
        if not active:
            ir.async_delete_issue(hass, DOMAIN, issue_id)
            return
        ir.async_create_issue(
            hass,
            DOMAIN,
            issue_id,
            is_fixable=fixable,
            severity=ir.IssueSeverity.WARNING,
            translation_key=key,
            translation_placeholders=placeholders,
            data=data,
        )

    @callback
    def evaluate(self, *_) -> None:
        rt = self._rt

        missing = self.missing_entities()
        listed = ", ".join(missing[:MAX_LISTED]) + ("…" if len(missing) > MAX_LISTED else "")
        self._issue(
            "missing_entities",
            bool(missing),
            placeholders={"prefix": rt.prefix, "count": str(len(missing)), "entities": listed},
        )

        service = rt.conf.get(CONF_NOTIFY) or ""
        domain, _, name = service.partition(".")
        found = bool(name) and rt.hass.services.has_service(domain, name)
        self._issue(
            "notify_service_missing",
            not found,
            fixable=True,
            placeholders={"service": service or "(vide)"},
            data={"entry_id": rt.entry.entry_id},
        )

        recent = self.recent_restarts()
        self._issue(
            "frequent_restarts",
            len(recent) >= RESTART_LIMIT,
            placeholders={"count": str(len(recent)), "hours": "24"},
        )
