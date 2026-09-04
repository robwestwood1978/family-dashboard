"""Data coordinator for Family Dashboard Classroom."""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed, OAuth2TokenRequestReauthError
from homeassistant.helpers import config_entry_oauth2_flow
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, UPDATE_INTERVAL, account_unique_id
from .provider import (
    ClassroomApiError,
    ClassroomAuthError,
    ClassroomData,
    ClassroomProvider,
    LastGoodClassroomFeed,
)

_LOGGER = logging.getLogger(__name__)


class ClassroomCoordinator(DataUpdateCoordinator[ClassroomData]):
    """Poll one child's Classroom account every fifteen minutes."""

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: ConfigEntry,
        oauth_session: config_entry_oauth2_flow.OAuth2Session,
    ) -> None:
        super().__init__(
            hass,
            _LOGGER,
            config_entry=config_entry,
            name=f"{DOMAIN}_{config_entry.entry_id}",
            update_interval=UPDATE_INTERVAL,
            always_update=False,
        )
        self._oauth_session = oauth_session
        self._feed = LastGoodClassroomFeed(ClassroomProvider(oauth_session))

    async def _async_update_data(self) -> ClassroomData:
        try:
            # Let Home Assistant refresh and persist the OAuth token before the
            # provider performs any API requests.
            await self._oauth_session.async_ensure_token_valid()
            data = await self._feed.async_fetch()
            if (
                self.config_entry.unique_id is None
                or account_unique_id(data.account_id) != self.config_entry.unique_id
            ):
                raise ConfigEntryAuthFailed(
                    "The authorized Google Classroom account does not match this child"
                )
            return data
        except OAuth2TokenRequestReauthError as err:
            raise ConfigEntryAuthFailed(
                "Google Classroom authorization needs attention"
            ) from err
        except ClassroomAuthError as err:
            raise ConfigEntryAuthFailed(str(err)) from err
        except ClassroomApiError as err:
            raise UpdateFailed(str(err)) from err
        except Exception as err:
            status = getattr(err, "status", None)
            if status in (400, 401):
                raise ConfigEntryAuthFailed(
                    "Google Classroom authorization needs attention"
                ) from err
            raise UpdateFailed("Unable to refresh Google Classroom") from err
