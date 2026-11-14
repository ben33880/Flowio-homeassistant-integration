from homeassistant.components.repairs import ConfirmRepairFlow, RepairsFlow
from homeassistant.core import HomeAssistant


async def async_create_fix_flow(hass: HomeAssistant, issue_id: str, data) -> RepairsFlow:
    """Aucune réparation guidée depuis la 0.3.0 : les réparations signalent, l'utilisateur corrige dans Configurer."""
    return ConfirmRepairFlow()
