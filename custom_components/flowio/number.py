from homeassistant.components.number import NumberMode, RestoreNumber
from homeassistant.const import EntityCategory
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import DOMAIN, THRESHOLDS


async def async_setup_entry(hass, entry, async_add_entities):
    rt = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(ThresholdNumber(rt, t) for t in THRESHOLDS)


class ThresholdNumber(RestoreNumber):
    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_mode = NumberMode.BOX
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, rt, t):
        self._rt, self._t = rt, t
        self._attr_unique_id = f"{rt.prefix}_threshold_{t.key}"
        self._attr_name = t.name
        self._attr_icon = t.icon
        self._attr_native_min_value, self._attr_native_max_value = t.min, t.max
        self._attr_native_step = t.step
        self._attr_native_unit_of_measurement = t.unit
        self._attr_native_value = t.default
        self._attr_device_info = rt.device_info

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last = await self.async_get_last_number_data()
        if last and last.native_value is not None:
            self._attr_native_value = last.native_value
        self._rt.values[self._t.key] = self._attr_native_value
        async_dispatcher_send(self.hass, self._rt.signal)

    async def async_set_native_value(self, value: float) -> None:
        self._attr_native_value = value
        self._rt.values[self._t.key] = value
        self.async_write_ha_state()
        async_dispatcher_send(self.hass, self._rt.signal)
