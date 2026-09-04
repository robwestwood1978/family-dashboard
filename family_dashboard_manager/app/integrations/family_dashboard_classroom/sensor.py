"""Open-assignment sensor for Family Dashboard Classroom."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_CHILD_NAME, DOMAIN
from .coordinator import ClassroomCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Add the one bounded assignment sensor for this child."""
    coordinator: ClassroomCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities((ClassroomOpenAssignmentsSensor(coordinator, entry),))


class ClassroomOpenAssignmentsSensor(CoordinatorEntity[ClassroomCoordinator], SensorEntity):
    """Count the child's open Classroom submissions."""

    _attr_icon = "mdi:school-outline"
    _attr_should_poll = False
    _unrecorded_attributes = frozenset(
        {
            "assignments",
            "assignments_truncated",
            "last_successful_update",
            "data_stale",
            "last_error",
        }
    )

    def __init__(self, coordinator: ClassroomCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        child_name = str(entry.data[CONF_CHILD_NAME])
        if entry.unique_id is None:
            raise ValueError("Classroom config entry is missing its account identity")
        self._attr_name = f"{child_name} Classroom open assignments"
        self._attr_unique_id = f"{entry.unique_id}_open_assignments"

    @property
    def native_value(self) -> int:
        """Return the complete open-assignment count."""
        return self.coordinator.data.open_count

    @property
    def extra_state_attributes(self) -> dict:
        """Expose no more than twenty dashboard-safe assignment summaries."""
        data = self.coordinator.data
        return {
            "assignments": [item.as_attribute() for item in data.assignments],
            "assignments_truncated": data.assignments_truncated,
            "last_successful_update": data.fetched_at,
            "data_stale": data.stale,
            "last_error": data.last_error,
        }
