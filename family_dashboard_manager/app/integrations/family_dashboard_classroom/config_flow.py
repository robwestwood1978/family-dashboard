"""Config flow for Family Dashboard Classroom."""

from __future__ import annotations

from collections.abc import Mapping
import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import SOURCE_REAUTH, ConfigFlowResult
from homeassistant.helpers import config_entry_oauth2_flow
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_CHILD_NAME,
    DOMAIN as INTEGRATION_DOMAIN,
    OAUTH_SCOPES,
    account_unique_id,
    has_exact_oauth_scopes,
)
from .provider import (
    ClassroomApiError,
    ClassroomAuthError,
    ClassroomIdentityUnavailable,
    ClassroomProvider,
)

_LOGGER = logging.getLogger(__name__)


class _FreshAccessTokenSession:
    """Use the just-issued token in memory for the pre-entry identity probe."""

    def __init__(self, session: Any, access_token: str) -> None:
        self._session = session
        self._access_token = access_token

    async def async_request(self, method: str, url: str, **kwargs: Any) -> Any:
        headers = dict(kwargs.pop("headers", {}))
        headers["Authorization"] = f"Bearer {self._access_token}"
        return await self._session.request(method, url, headers=headers, **kwargs)


class OAuth2FlowHandler(
    config_entry_oauth2_flow.AbstractOAuth2FlowHandler,
    domain=INTEGRATION_DOMAIN,
):
    """Handle one child-owned Classroom authorization."""

    VERSION = 1
    MINOR_VERSION = 1
    DOMAIN = INTEGRATION_DOMAIN

    def __init__(self) -> None:
        """Initialize flow-local, non-secret context."""
        self._child_name: str | None = None

    @property
    def logger(self) -> logging.Logger:
        """Return the integration logger used by the OAuth base flow."""
        return _LOGGER

    @property
    def extra_authorize_data(self) -> dict[str, str]:
        """Request only the two accepted read-only Classroom scopes."""
        return {
            "scope": " ".join(OAUTH_SCOPES),
            "access_type": "offline",
            "prompt": "select_account consent",
            "include_granted_scopes": "false",
        }

    def _child_is_configured(self, child_name: str) -> bool:
        return any(
            str(entry.data.get(CONF_CHILD_NAME, "")).casefold()
            == child_name.casefold()
            for entry in self._async_current_entries()
        )

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Collect the dashboard child label before leaving for Google."""
        errors: dict[str, str] = {}
        if user_input is not None:
            child_name = str(user_input.get(CONF_CHILD_NAME, "")).strip()
            if not child_name or len(child_name) > 64:
                errors["base"] = "invalid_child_name"
            elif self._child_is_configured(child_name):
                return self.async_abort(reason="already_configured")
            else:
                self._child_name = child_name
                return await self.async_step_pick_implementation()
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({vol.Required(CONF_CHILD_NAME): str}),
            errors=errors,
        )

    async def async_step_reauth(self, entry_data: Mapping[str, Any]) -> ConfigFlowResult:
        """Ask for deliberate reauthorization after a rejected token."""
        self._child_name = str(entry_data[CONF_CHILD_NAME])
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Confirm that the same child's Google account should be relinked."""
        if user_input is None:
            return self.async_show_form(step_id="reauth_confirm", data_schema=vol.Schema({}))
        return await self.async_step_pick_implementation()

    async def async_oauth_create_entry(self, data: dict[str, Any]) -> ConfigFlowResult:
        """Create one entry per child or update its token during reauth."""
        token_scope = data.get("token", {}).get("scope")
        if not has_exact_oauth_scopes(token_scope):
            return self.async_abort(reason="missing_scopes")

        access_token = data.get("token", {}).get("access_token")
        if not isinstance(access_token, str) or not access_token:
            return self.async_abort(reason="invalid_auth")
        try:
            identity = await ClassroomProvider(
                _FreshAccessTokenSession(async_get_clientsession(self.hass), access_token)
            ).async_fetch()
        except ClassroomIdentityUnavailable:
            return self.async_abort(reason="identity_unavailable")
        except ClassroomAuthError:
            return self.async_abort(reason="invalid_auth")
        except ClassroomApiError:
            return self.async_abort(reason="cannot_connect")

        await self.async_set_unique_id(account_unique_id(identity.account_id))

        if self.source == SOURCE_REAUTH:
            entry = self._get_reauth_entry()
            self._abort_if_unique_id_mismatch(reason="reauth_account_mismatch")
            return self.async_update_reload_and_abort(
                entry,
                data_updates={**entry.data, **data, CONF_CHILD_NAME: entry.data[CONF_CHILD_NAME]},
            )

        if self._child_name is None:
            return self.async_abort(reason="invalid_child_name")
        if self._child_is_configured(self._child_name):
            return self.async_abort(reason="already_configured")
        self._abort_if_unique_id_configured()
        return self.async_create_entry(
            title=f"{self._child_name} Classroom",
            data={**data, CONF_CHILD_NAME: self._child_name},
        )
