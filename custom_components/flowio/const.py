from dataclasses import dataclass

DOMAIN = "flowio"
URL_BASE = "/flowio_static"
JS_FILE = "flowio-home-assistant-cards.js"
PLATFORMS = ["number", "binary_sensor"]
SIGNAL_UPDATE = "flowio_update_{entry_id}"

CONF_PREFIX = "entity_prefix"
CONF_NOTIFY = "notify_service"
CONF_PH_TANK = "ph_tank_entity"
CONF_DIS_TANK = "disinfection_tank_entity"


@dataclass(frozen=True)
class Threshold:
    key: str
    name: str
    default: float
    min: float
    max: float
    step: float
    unit: str | None
    icon: str


THRESHOLDS = [
    Threshold("ph_min", "pH minimum", 7.0, 6.0, 8.5, 0.1, None, "mdi:ph"),
    Threshold("ph_max", "pH maximum", 7.8, 6.0, 8.5, 0.1, None, "mdi:ph"),
    Threshold("orp_min", "ORP minimum", 600, 300, 900, 10, "mV", "mdi:flash"),
    Threshold("temp_min", "Température gel", 4, -5, 15, 0.5, "°C", "mdi:snowflake-alert"),
    Threshold("temp_max", "Température eau maximum", 32, 20, 40, 0.5, "°C", "mdi:thermometer-high"),
    Threshold("tank_min", "Niveau cuve minimum", 15, 0, 50, 1, "%", "mdi:cup-water"),
    Threshold("offline_min", "Délai hors ligne", 10, 1, 120, 1, "min", "mdi:timer-alert"),
]


@dataclass(frozen=True)
class Alert:
    key: str
    name: str
    icon: str
    source: str
    op: str
    threshold: str
    delay_min: float
    unit: str = ""
    require_on: str | None = None


# delay_min = -1 : le délai vient du seuil (offline_min)
ALERTS = [
    Alert("ph_low", "pH trop bas", "mdi:ph", "sensor.{p}_io_ph", "<", "ph_min", 30),
    Alert("ph_high", "pH trop haut", "mdi:ph", "sensor.{p}_io_ph", ">", "ph_max", 30),
    Alert("orp_low", "ORP trop bas", "mdi:flash-alert", "sensor.{p}_io_orp", "<", "orp_min", 60, "mV",
          require_on="switch.{p}_io_flt_pmp"),
    Alert("frost", "Risque de gel", "mdi:snowflake-alert", "sensor.{p}_io_wat_tmp", "<", "temp_min", 0, "°C"),
    Alert("water_hot", "Eau trop chaude", "mdi:thermometer-alert", "sensor.{p}_io_wat_tmp", ">", "temp_max", 60, "°C"),
    Alert("ph_tank_low", "Cuve pH basse", "mdi:cup-water", f"conf:{CONF_PH_TANK}", "<", "tank_min", 0, "%"),
    Alert("dis_tank_low", "Cuve désinfectant basse", "mdi:cup-water", f"conf:{CONF_DIS_TANK}", "<", "tank_min", 0, "%"),
    Alert("offline", "Contrôleur hors ligne", "mdi:lan-disconnect", "sensor.{p}_io_wat_tmp", "unavailable", "offline_min", -1),
]
