from datetime import timedelta

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

from .const import ALERTS, DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    rt = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(AlertSensor(rt, a) for a in ALERTS if rt.resolve(a.source))


class AlertSensor(BinarySensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, rt, alert):
        self._rt, self._a = rt, alert
        self._source = rt.resolve(alert.source)
        self._require = rt.resolve(alert.require_on) if alert.require_on else None
        self._attr_unique_id = f"{rt.prefix}_alert_{alert.key}"
        self._attr_name, self._attr_icon = alert.name, alert.icon
        self._attr_device_info = rt.device_info
        self._attr_is_on = False
        self._cancel = None
        self._detail = ""

    async def async_added_to_hass(self):
        ids = [self._source] + ([self._require] if self._require else [])
        self.async_on_remove(async_track_state_change_event(self.hass, ids, self._changed))
        self.async_on_remove(async_dispatcher_connect(self.hass, self._rt.signal, self._reevaluate))
        self.async_on_remove(self._cancel_timer)
        self._reevaluate()

    @callback
    def _cancel_timer(self):
        if self._cancel:
            self._cancel()
            self._cancel = None

    @property
    def extra_state_attributes(self):
        return {
            "detail": self._detail,
            "source": self._source,
            "threshold": self._rt.values.get(self._a.threshold),
        }

    def _condition(self) -> bool:
        s = self.hass.states.get(self._source)
        a, thr = self._a, float(self._rt.values[self._a.threshold])
        if a.op == "unavailable":
            return s is None or s.state == "unavailable"
        if self._require:
            r = self.hass.states.get(self._require)
            if r is None or r.state != "on":
                return False
        try:
            v = float(s.state)
        except (ValueError, AttributeError, TypeError):
            return False
        self._detail = f"{v:g} {a.unit}".strip()
        return v < thr if a.op == "<" else v > thr

    def _delay(self) -> float:
        a = self._a
        return float(self._rt.values[a.threshold]) if a.delay_min < 0 else a.delay_min

    @callback
    def _changed(self, _event):
        self._reevaluate()

    @callback
    def _reevaluate(self, *_):
        if not self._condition():
            self._cancel_timer()
            if self._attr_is_on:
                self._set(False)
            return
        if self._attr_is_on or self._cancel:
            return
        delay = self._delay()
        if delay <= 0:
            self._set(True)
        else:
            self._cancel = async_call_later(self.hass, timedelta(minutes=delay), self._fire)

    @callback
    def _fire(self, _now):
        self._cancel = None
        if self._condition():
            self._set(True)

    @callback
    def _set(self, on: bool):
        self._attr_is_on = on
        self.async_write_ha_state()
        a = self._a
        if on:
            title = f"⚠️ {a.name}"
            msg = f"{self._detail} (seuil {float(self._rt.values[a.threshold]):g})".strip()
        else:
            title, msg = f"✅ {a.name} : résolu", "Retour à la normale."
        self.hass.async_create_task(self._rt.async_notify(title, msg, a.key))
