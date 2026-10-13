"""One private household homework store, configured without credentials."""
from homeassistant import config_entries
from . import DOMAIN


class HomeworkConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Family homework", data={})
        return self.async_show_form(step_id="user")
