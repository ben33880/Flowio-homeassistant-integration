from datetime import timedelta

from homeassistant.core import callback
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import ALERTS, DOMAIN

STARTUP_DELAY = 120  # secondes : laisse le temps à MQTT et aux notifications de se charger
CHECK_INTERVAL = timedelta(minutes=15)
RESTART_WINDOW = timedelta(hours=24)
RESTART_LIMIT = 3
MAX_LISTED = 10

# Entités lues en plus de celles des alertes (vérifiées dans le firmware Flow.io-Waveshare).
EXTRA_ENTITIES = [
    "number.{p}_pd1_flow",
    "number.{p}_pd2_flow",
    "sensor.{p}_sys_upt_mn",
]

# Groupes de repli : une seule entité du groupe suffit (compteur métier firmware 3.5.1, sinon data_*).
RUNTIME_GROUPS = [
    ["sensor.{p}_pd_ph_pmp_upt", "sensor.{p}_data_{ph_rt}"],
    ["sensor.{p}_pd_chl_pmp_upt", "sensor.{p}_data_{dis_rt}"],
]


class HealthMonitor:
    """Vérifie la cohérence de l'installation et publie des réparations Home Assistant."""

    def __init__(self, rt):
        self._rt = rt
        self._unsubs = []
        eid = rt.entry.entry_id
        self._ids = {
            key: f"{key}_{eid}"
            for key in ("missing_entities", "mobile_device_unreachable", "frequent_restarts")
        }
        # Réparation des versions 0.2.x (service de notification), supprimée en 0.3.0.
        self._stale = f"notify_service_missing_{eid}"

    def required_groups(self) -> list[list[str]]:
        rt = self._rt
        singles = [a.source for a in ALERTS] + [a.require_on for a in ALERTS if a.require_on]
        singles += EXTRA_ENTITIES
        groups = {(rt.resolve(t),) for t in singles}
        groups |= {tuple(rt.resolve(t) for t in g) for g in RUNTIME_GROUPS}
        return [list(g) for g in sorted(groups)]

    def expected_entities(self) -> list[str]:
        return sorted({e for group in self.required_groups() for e in group})

    def missing_entities(self) -> list[str]:
        states = self._rt.hass.states
        return [
            " | ".join(group)
            for group in self.required_groups()
            if all(states.get(e) is None for e in group)
        ]

    def recent_restarts(self) -> list:
        now = dt_util.utcnow()
        return [t for t in self._rt.restarts if now - t < RESTART_WINDOW]

    def start(self) -> None:
        hass = self._rt.hass
        ir.async_delete_issue(hass, DOMAIN, self._stale)
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

        # Appareils mobiles choisis mais supprimés ou sans service de notification.
        unreachable = rt.unreachable_targets()
        self._issue(
            "mobile_device_unreachable",
            bool(unreachable),
            placeholders={"devices": ", ".join(unreachable)},
        )

        recent = self.recent_restarts()
        self._issue(
            "frequent_restarts",
            len(recent) >= RESTART_LIMIT,
            placeholders={"count": str(len(recent)), "hours": "24"},
        )
