import json
import logging
import math
import statistics

from homeassistant.components import mqtt
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import EntityCategory, UnitOfTime
from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.restore_state import RestoredExtraData, RestoreEntity
from homeassistant.util import dt as dt_util

from .const import CONF_MQTT_ROOT, DOMAIN, HISTORY_DAYS
from .quality import BAD, GOOD, MEDIUM, as_float, grade, worst

_LOGGER = logging.getLogger(__name__)

FILTRATION = "switch.{p}_io_flt_pmp"
UNRELIABLE_WARNING = (
    "Filtration arrêtée : l'eau stagne autour des sondes, le pH et l'ORP peuvent être erronés."
)

# Unités publiées par le firmware : s, mn (compteurs métier pd_flt_upt_mn), min, h.
_TIME = {"s": 1, "sec": 1, "min": 60, "mn": 60, "h": 3600}
_FLOW = {"l/h": 1.0, "ml/h": 0.001}
MAX_RESTARTS_KEPT = 20
TREND_KEEP_HOURS = 7 * 24
TREND_MIN_POINTS = 4
TREND_MIN_SPAN_H = 6


def _unit(state, default: str) -> str:
    return (state.attributes.get("unit_of_measurement") or default).lower().replace(" ", "")


async def async_setup_entry(hass, entry, async_add_entities):
    rt = hass.data[DOMAIN][entry.entry_id]
    ph = ("ph", "sensor.{p}_io_ph")
    orp = ("orp", "sensor.{p}_io_orp")
    async_add_entities(
        [
            QualitySensor(rt, "ph_quality", "Qualité pH", "mdi:ph", [ph]),
            QualitySensor(rt, "orp_quality", "Qualité ORP", "mdi:flash", [orp]),
            QualitySensor(rt, "water_quality", "Qualité de l'eau", "mdi:pool", [ph, orp]),
            InjectedSensor(rt, "ph_injected", "pH injecté", "ph",
                           ["sensor.{p}_pd_ph_pmp_upt", "sensor.{p}_data_{ph_rt}"],
                           "number.{p}_pd1_flow"),
            InjectedSensor(rt, "dis_injected", "Désinfectant injecté", "dis",
                           ["sensor.{p}_pd_chl_pmp_upt", "sensor.{p}_data_{dis_rt}"],
                           "number.{p}_pd2_flow"),
            AutonomySensor(rt, "ph_autonomy", "Autonomie cuve pH", "ph", "sensor.{p}_data_{ph_vol}"),
            AutonomySensor(rt, "dis_autonomy", "Autonomie cuve désinfectant", "dis",
                           "sensor.{p}_data_{dis_vol}"),
            TrendSensor(rt, "ph_trend", "Tendance pH (24 h)", "mdi:trending-up", "sensor.{p}_io_ph", "pH/24 h", 3),
            TrendSensor(rt, "orp_trend", "Tendance ORP (24 h)", "mdi:trending-up", "sensor.{p}_io_orp",
                        "mV/24 h", 1),
            RestartSensor(rt),
        ]
    )


class _Base(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, rt, key, name, icon, watch):
        self._rt = rt
        self._attr_unique_id = f"{rt.prefix}_{key}"
        self._attr_name, self._attr_icon = name, icon
        self._attr_device_info = rt.device_info
        self._watch = sorted(set(watch))

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        if self._watch:
            self.async_on_remove(async_track_state_change_event(self.hass, self._watch, self._changed))
        self.async_on_remove(async_dispatcher_connect(self.hass, self._rt.signal, self._refresh))
        self._refresh()

    @callback
    def _changed(self, _event):
        self._refresh()

    @callback
    def _refresh(self, *_):
        self._compute()
        self.async_write_ha_state()

    def _compute(self):
        raise NotImplementedError


class QualitySensor(_Base):
    """Qualité bon/moyen/mauvais, toujours évaluée ; l'attribut warning signale une filtration arrêtée."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_translation_key = "quality"
    _attr_options = [GOOD, MEDIUM, BAD]

    def __init__(self, rt, key, name, icon, measures):
        self._m = [(p, rt.resolve(s)) for p, s in measures]
        self._flt = rt.resolve(FILTRATION)
        super().__init__(rt, key, name, icon, [s for _, s in self._m] + [self._flt])

    def _compute(self):
        grades, attrs = [], {}
        for prefix, src in self._m:
            value = as_float(self.hass.states.get(src))
            if value is None:
                continue
            g = grade(self._rt.values, prefix, value)
            grades.append(g)
            attrs[f"{prefix}_value"], attrs[f"{prefix}_grade"] = value, g
        flt = self.hass.states.get(self._flt)
        running = None if flt is None or flt.state not in ("on", "off") else flt.state == "on"
        attrs["filtration_running"] = running
        if running is False:
            attrs["warning"] = UNRELIABLE_WARNING
        self._attr_native_value = worst(grades)
        self._attr_extra_state_attributes = attrs


class InjectedSensor(RestoreEntity, _Base):
    """Volume injecté du jour.

    Source 1 (si la racine MQTT est configurée) : injected.day_ml mesuré par le firmware sur
    <racine>/rt/pdm/metrics/pd<slot>, retenu s'il date du jour courant.
    Source 2 (repli) : estimation = temps de marche (s) / 3600 x débit configuré (L/h) x 1000.
    """

    _attr_native_unit_of_measurement = "mL"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, rt, key, name, pump, rt_srcs, flow_src):
        self._model = rt.pumps[pump]
        self._slot = rt.ph_slot if pump == "ph" else rt.dis_slot
        self._fw_ml = None
        self._fw_day = None
        self._rt_srcs = [rt.resolve(s) for s in rt_srcs]
        self._flow_src = rt.resolve(flow_src)
        super().__init__(rt, key, name, "mdi:beaker-outline", [*self._rt_srcs, self._flow_src])

    async def async_added_to_hass(self):
        last = await self.async_get_last_state()
        if last and isinstance(last.attributes.get("history_ml"), list):
            try:
                self._model.history = [float(x) for x in last.attributes["history_ml"]][-HISTORY_DAYS:]
            except (TypeError, ValueError):
                pass
        await super().async_added_to_hass()
        await self._subscribe_firmware()
        async_dispatcher_send(self.hass, self._rt.signal_pumps)

    async def _subscribe_firmware(self):
        root = (self._rt.conf.get(CONF_MQTT_ROOT) or "").strip().strip("/")
        if not root:
            return
        topic = f"{root}/rt/pdm/metrics/pd{self._slot}"
        try:
            unsubscribe = await mqtt.async_subscribe(self.hass, topic, self._on_metrics, 0)
        except HomeAssistantError as err:
            _LOGGER.warning("Abonnement MQTT impossible (%s) : estimation utilisée (%s)", topic, err)
            return
        self.async_on_remove(unsubscribe)

    @callback
    def _on_metrics(self, msg) -> None:
        try:
            data = json.loads(msg.payload)
            value = float(data["injected"]["day_ml"])
        except (TypeError, ValueError, KeyError):
            return
        if not math.isfinite(value) or value < 0:
            return
        self._fw_ml = value
        self._fw_day = dt_util.now().date()
        self._refresh()

    def _runtime_state(self):
        """Première source du compteur de marche qui a une valeur exploitable."""
        for entity_id in self._rt_srcs:
            state = self.hass.states.get(entity_id)
            if state is not None and as_float(state) is not None:
                return entity_id, state
        return self._rt_srcs[0], self.hass.states.get(self._rt_srcs[0])

    def _compute(self):
        source, rt_state = self._runtime_state()
        flow_state = self.hass.states.get(self._flow_src)
        secs = lph = None
        value = as_float(rt_state)
        if value is not None and value >= 0:
            factor = _TIME.get(_unit(rt_state, "s"))
            secs = value * factor if factor else None
        value = as_float(flow_state)
        if value is not None and value >= 0:
            factor = _FLOW.get(_unit(flow_state, "l/h"))
            lph = value * factor if factor else None
        estimate = round(secs / 3600 * lph * 1000) if secs is not None and lph is not None else None

        firmware = self._fw_ml if self._fw_day == dt_util.now().date() else None
        if firmware is not None:
            ml, origin = round(firmware), "firmware"
        elif estimate is not None:
            ml, origin = estimate, "estimation"
        else:
            ml, origin = None, None

        m = self._model
        if ml is None:
            self._attr_native_value = None
        else:
            # Remise à zéro du compteur du jour : le dernier total devient un jour complet.
            if m.last_ml and ml < 0.5 * m.last_ml:
                m.history = (m.history + [m.last_ml])[-HISTORY_DAYS:]
                async_dispatcher_send(self.hass, self._rt.signal_pumps)
            changed = m.last_ml != ml
            m.last_ml = ml
            self._attr_native_value = ml
            if changed:
                async_dispatcher_send(self.hass, self._rt.signal_dosing)
        self._attr_extra_state_attributes = {
            "value_source": origin,
            "firmware_day_ml": self._fw_ml,
            "estimated_ml": estimate,
            "history_ml": list(m.history),
            "runtime_source": source,
            "runtime_s": secs,
            "flow_l_h": lph,
        }


class AutonomySensor(_Base):
    """Jours restants = volume de la cuve / moyenne des totaux journaliers injectés."""

    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.DAYS
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 1

    def __init__(self, rt, key, name, pump, tank_src):
        self._model = rt.pumps[pump]
        self._tank = rt.resolve(tank_src)
        super().__init__(rt, key, name, "mdi:timer-sand", [self._tank])

    async def async_added_to_hass(self):
        self.async_on_remove(async_dispatcher_connect(self.hass, self._rt.signal_pumps, self._refresh))
        await super().async_added_to_hass()

    def _compute(self):
        state = self.hass.states.get(self._tank)
        volume = as_float(state)
        factor = {"l": 1.0, "ml": 0.001}.get(_unit(state, "l")) if volume is not None else None
        hist = self._model.history
        avg = sum(hist) / len(hist) if hist else 0
        if volume is None or factor is None or avg <= 0:
            self._attr_native_value = None
            self._attr_extra_state_attributes = {"days_observed": len(hist)}
            return
        litres = volume * factor
        self._attr_native_value = round(litres * 1000 / avg, 1)
        self._attr_extra_state_attributes = {
            "tank_l": litres,
            "average_daily_ml": round(avg),
            "days_observed": len(hist),
        }


def _slope(points: list[tuple[int, float]], min_span: int) -> float | None:
    """Pente des moindres carrés (unité par heure), ou None si les points sont trop peu nombreux ou groupés."""
    if len(points) < TREND_MIN_POINTS:
        return None
    hours = [h for h, _ in points]
    if max(hours) - min(hours) < min_span:
        return None
    mean_h = statistics.fmean(hours)
    mean_v = statistics.fmean(v for _, v in points)
    denominator = sum((h - mean_h) ** 2 for h in hours)
    return sum((h - mean_h) * (v - mean_v) for h, v in points) / denominator


class TrendSensor(RestoreEntity, _Base):
    """Dérive du pH ou de l'ORP : pente sur 24 h, exprimée par 24 h.

    Seules les mesures prises filtration en marche sont retenues (sinon elles sont peu fiables), en moyennes
    horaires gardées 7 jours. L'attribut slope_7d_per_day donne la dérive à plus long terme ; std_24h mesure
    la stabilité. Sans assez de données, l'état est inconnu.
    """

    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, rt, key, name, icon, source, unit, decimals):
        self._src = rt.resolve(source)
        self._flt = rt.resolve(FILTRATION)
        self._decimals = decimals
        self._buckets: dict[int, list[float]] = {}  # heure (époque / 3600) -> [somme, nombre]
        self._attr_native_unit_of_measurement = unit
        super().__init__(rt, key, name, icon, [self._src, self._flt])

    @property
    def extra_restore_state_data(self):
        return RestoredExtraData({"buckets": {str(h): v for h, v in self._buckets.items()}})

    async def async_added_to_hass(self):
        extra = await self.async_get_last_extra_data()
        if extra:
            try:
                self._buckets = {
                    int(h): [float(v[0]), float(v[1])] for h, v in extra.as_dict().get("buckets", {}).items()
                }
            except (TypeError, ValueError, IndexError, AttributeError):
                self._buckets = {}
        await super().async_added_to_hass()

    @staticmethod
    def _now_hour() -> int:
        return int(dt_util.utcnow().timestamp() // 3600)

    @callback
    def _changed(self, event):
        if event.data["entity_id"] == self._src:
            self._sample()
        self._refresh()

    def _sample(self):
        flt = self.hass.states.get(self._flt)
        value = as_float(self.hass.states.get(self._src))
        if value is None or flt is None or flt.state != "on":
            return
        bucket = self._buckets.setdefault(self._now_hour(), [0.0, 0])
        bucket[0] += value
        bucket[1] += 1

    def _points(self, hours: int) -> list[tuple[int, float]]:
        now = self._now_hour()
        return [(h, s / n) for h, (s, n) in self._buckets.items() if now - hours <= h <= now and n]

    def _compute(self):
        now = self._now_hour()
        self._buckets = {h: v for h, v in self._buckets.items() if h >= now - TREND_KEEP_HOURS}
        day = self._points(24)
        slope_day = _slope(day, TREND_MIN_SPAN_H)
        slope_week = _slope(self._points(TREND_KEEP_HOURS), 24)
        self._attr_native_value = round(slope_day * 24, self._decimals) if slope_day is not None else None
        self._attr_extra_state_attributes = {
            "slope_7d_per_day": round(slope_week * 24, self._decimals) if slope_week is not None else None,
            "std_24h": round(statistics.pstdev(v for _, v in day), self._decimals + 1) if len(day) >= 2 else None,
            "hours_with_data_24h": len(day),
            "hours_with_data_7d": len(self._points(TREND_KEEP_HOURS)),
        }


class RestartSensor(RestoreEntity, _Base):
    """Compte les redémarrages du contrôleur détectés par une baisse du temps de fonctionnement (minutes)."""

    _attr_entity_category = EntityCategory.DIAGNOSTIC
    _attr_state_class = SensorStateClass.TOTAL_INCREASING

    def __init__(self, rt):
        self._src = rt.resolve("sensor.{p}_sys_upt_mn")
        self._last_uptime = None
        self._count = 0
        super().__init__(rt, "restarts", "Redémarrages du contrôleur", "mdi:restart-alert", [self._src])

    async def async_added_to_hass(self):
        last = await self.async_get_last_state()
        if last:
            try:
                self._count = int(float(last.state))
            except (TypeError, ValueError):
                pass
            raw = last.attributes.get("restart_times") or []
            parsed = [dt_util.parse_datetime(x) for x in raw if isinstance(x, str)]
            self._rt.restarts = [t for t in parsed if t][-MAX_RESTARTS_KEPT:]
        await super().async_added_to_hass()

    def _compute(self):
        value = as_float(self.hass.states.get(self._src))
        if value is not None:
            if self._last_uptime is not None and value < self._last_uptime - 1:
                self._count += 1
                self._rt.restarts = (self._rt.restarts + [dt_util.utcnow()])[-MAX_RESTARTS_KEPT:]
                self._rt.health.evaluate()
            self._last_uptime = value
        self._attr_native_value = self._count
        self._attr_extra_state_attributes = {
            "restart_times": [t.isoformat() for t in self._rt.restarts],
            "restarts_24h": len(self._rt.health.recent_restarts()),
            "uptime_min": self._last_uptime,
        }
