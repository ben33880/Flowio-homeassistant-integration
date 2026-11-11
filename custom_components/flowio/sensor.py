from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import EntityCategory, UnitOfTime
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, HISTORY_DAYS
from .quality import BAD, GOOD, MEDIUM, as_float, grade, worst

_TIME = {"s": 1, "sec": 1, "min": 60, "h": 3600}
_FLOW = {"l/h": 1.0, "ml/h": 0.001}
MAX_RESTARTS_KEPT = 20


def _unit(state, default: str) -> str:
    return (state.attributes.get("unit_of_measurement") or default).lower().replace(" ", "")


async def async_setup_entry(hass, entry, async_add_entities):
    rt = hass.data[DOMAIN][entry.entry_id]
    ph = ("ph", "sensor.{p}_io_ph", None)
    orp = ("orp", "sensor.{p}_io_orp", "switch.{p}_io_flt_pmp")
    async_add_entities(
        [
            QualitySensor(rt, "ph_quality", "Qualité pH", "mdi:ph", [ph]),
            QualitySensor(rt, "orp_quality", "Qualité ORP", "mdi:flash", [orp]),
            QualitySensor(rt, "water_quality", "Qualité de l'eau", "mdi:pool", [ph, orp]),
            InjectedSensor(rt, "ph_injected", "pH injecté (estimé)", "ph",
                           "sensor.{p}_data_{ph_rt}", "number.{p}_pd1_flow"),
            InjectedSensor(rt, "dis_injected", "Désinfectant injecté (estimé)", "dis",
                           "sensor.{p}_data_{dis_rt}", "number.{p}_pd2_flow"),
            AutonomySensor(rt, "ph_autonomy", "Autonomie cuve pH", "ph", "sensor.{p}_data_{ph_vol}"),
            AutonomySensor(rt, "dis_autonomy", "Autonomie cuve désinfectant", "dis",
                           "sensor.{p}_data_{dis_vol}"),
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
    """Qualité bon/moyen/mauvais ; l'ORP n'est évalué que filtration en marche."""

    _attr_device_class = SensorDeviceClass.ENUM
    _attr_translation_key = "quality"
    _attr_options = [GOOD, MEDIUM, BAD]

    def __init__(self, rt, key, name, icon, measures):
        self._m = [(p, rt.resolve(s), rt.resolve(r) if r else None) for p, s, r in measures]
        super().__init__(rt, key, name, icon, [e for _, s, r in self._m for e in (s, r) if e])

    def _compute(self):
        grades, attrs = [], {}
        for prefix, src, req in self._m:
            if req:
                r = self.hass.states.get(req)
                if r is None or r.state != "on":
                    continue
            value = as_float(self.hass.states.get(src))
            if value is None:
                continue
            g = grade(self._rt.values, prefix, value)
            grades.append(g)
            attrs[f"{prefix}_value"], attrs[f"{prefix}_grade"] = value, g
        self._attr_native_value = worst(grades)
        self._attr_extra_state_attributes = attrs


class InjectedSensor(RestoreEntity, _Base):
    """Volume injecté estimé du jour : temps de marche (s) / 3600 x débit configuré (L/h) x 1000."""

    _attr_native_unit_of_measurement = "mL"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, rt, key, name, pump, rt_src, flow_src):
        self._model = rt.pumps[pump]
        self._rt_src, self._flow_src = rt.resolve(rt_src), rt.resolve(flow_src)
        super().__init__(rt, key, name, "mdi:beaker-outline", [self._rt_src, self._flow_src])

    async def async_added_to_hass(self):
        last = await self.async_get_last_state()
        if last and isinstance(last.attributes.get("history_ml"), list):
            try:
                self._model.history = [float(x) for x in last.attributes["history_ml"]][-HISTORY_DAYS:]
            except (TypeError, ValueError):
                pass
        await super().async_added_to_hass()
        async_dispatcher_send(self.hass, self._rt.signal_pumps)

    def _compute(self):
        rt_state = self.hass.states.get(self._rt_src)
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
        m = self._model
        if secs is None or lph is None:
            self._attr_native_value = None
        else:
            ml = round(secs / 3600 * lph * 1000)
            # Remise à zéro du compteur du jour : le dernier total devient un jour complet.
            if m.last_ml and ml < 0.5 * m.last_ml:
                m.history = (m.history + [m.last_ml])[-HISTORY_DAYS:]
                async_dispatcher_send(self.hass, self._rt.signal_pumps)
            m.last_ml = ml
            self._attr_native_value = ml
        self._attr_extra_state_attributes = {
            "history_ml": list(m.history),
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


class RestartSensor(RestoreEntity, _Base):
    """Compte les redémarrages du contrôleur détectés par une baisse du temps de fonctionnement."""

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
