from dataclasses import dataclass

DOMAIN = "flowio"
URL_BASE = "/flowio_static"
JS_FILE = "flowio-home-assistant-cards.js"
PLATFORMS = ["number", "binary_sensor", "sensor"]
SIGNAL_UPDATE = "flowio_update_{entry_id}"
SIGNAL_PUMPS = "flowio_pumps_{entry_id}"

CONF_PREFIX = "entity_prefix"
CONF_NOTIFY = "notify_service"
CONF_PH_SLOT = "ph_slot"
CONF_DIS_SLOT = "disinfection_slot"
CONF_NOTIFY_MEDIUM = "notify_medium"
DEFAULT_PH_SLOT = 1
DEFAULT_DIS_SLOT = 2
HISTORY_DAYS = 7


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


# pH : bon 7,0–7,4, moyen 6,8–7,6 (valeurs de CHEMISTRY.md des cartes).
# ORP : cible 650–750 mV (CHEMISTRY.md) ; les bornes « moyen » 600–800 mV sont un choix par défaut à ajuster.
THRESHOLDS = [
    Threshold("ph_good_min", "pH bon – minimum", 7.0, 5.5, 9.0, 0.1, None, "mdi:ph"),
    Threshold("ph_good_max", "pH bon – maximum", 7.4, 5.5, 9.0, 0.1, None, "mdi:ph"),
    Threshold("ph_mid_min", "pH moyen – minimum", 6.8, 5.5, 9.0, 0.1, None, "mdi:ph"),
    Threshold("ph_mid_max", "pH moyen – maximum", 7.6, 5.5, 9.0, 0.1, None, "mdi:ph"),
    Threshold("orp_good_min", "ORP bon – minimum", 650, 300, 1000, 10, "mV", "mdi:flash"),
    Threshold("orp_good_max", "ORP bon – maximum", 750, 300, 1000, 10, "mV", "mdi:flash"),
    Threshold("orp_mid_min", "ORP moyen – minimum", 600, 300, 1000, 10, "mV", "mdi:flash"),
    Threshold("orp_mid_max", "ORP moyen – maximum", 800, 300, 1000, 10, "mV", "mdi:flash"),
    Threshold("temp_min", "Gel – seuil", 4, -5, 15, 0.5, "°C", "mdi:snowflake-alert"),
    Threshold("temp_max", "Eau chaude – seuil", 32, 20, 40, 0.5, "°C", "mdi:thermometer-high"),
    Threshold("tank_min", "Niveau cuve minimum", 15, 0, 50, 1, "%", "mdi:cup-water"),
    Threshold("offline_min", "Délai hors ligne", 10, 1, 120, 1, "min", "mdi:timer-alert"),
]


@dataclass(frozen=True)
class Alert:
    key: str
    name: str
    icon: str
    source: str
    op: str  # "<", ">", "unavailable", "q_bad", "q_medium"
    threshold: str  # clé de THRESHOLDS, ou préfixe de bande (ph/orp) pour q_*
    delay_min: float  # -1 : délai pris dans le seuil (offline_min)
    unit: str = ""
    require_on: str | None = None  # alerte en pause tant que cette entité n'est pas « on »
    soft: bool = False  # notifié seulement si l'option « notify_medium » est active


# pH et ORP : mesures peu fiables pompe arrêtée, donc alertes seulement filtration en marche.
# Gel, eau chaude, cuves et contrôleur hors ligne restent actifs en permanence.
ALERTS = [
    Alert("ph_bad", "pH mauvais", "mdi:ph", "sensor.{p}_io_ph", "q_bad", "ph", 30,
          require_on="switch.{p}_io_flt_pmp"),
    Alert("ph_medium", "pH à surveiller", "mdi:ph", "sensor.{p}_io_ph", "q_medium", "ph", 60,
          require_on="switch.{p}_io_flt_pmp", soft=True),
    Alert("orp_bad", "ORP mauvais", "mdi:flash-alert", "sensor.{p}_io_orp", "q_bad", "orp", 60, "mV",
          require_on="switch.{p}_io_flt_pmp"),
    Alert("orp_medium", "ORP à surveiller", "mdi:flash", "sensor.{p}_io_orp", "q_medium", "orp", 120, "mV",
          require_on="switch.{p}_io_flt_pmp", soft=True),
    Alert("frost", "Risque de gel", "mdi:snowflake-alert", "sensor.{p}_io_wat_tmp", "<", "temp_min", 0, "°C"),
    Alert("water_hot", "Eau trop chaude", "mdi:thermometer-alert", "sensor.{p}_io_wat_tmp", ">", "temp_max", 60, "°C"),
    Alert("ph_tank_low", "Cuve pH basse", "mdi:cup-water", "sensor.{p}_data_{ph_pct}", "<", "tank_min", 0, "%"),
    Alert("dis_tank_low", "Cuve désinfectant basse", "mdi:cup-water", "sensor.{p}_data_{dis_pct}", "<", "tank_min", 0, "%"),
    Alert("offline", "Contrôleur hors ligne", "mdi:lan-disconnect", "sensor.{p}_io_wat_tmp", "unavailable", "offline_min", -1),
]
