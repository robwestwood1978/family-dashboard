"""Constants for the Family Dashboard Classroom integration."""

from datetime import timedelta
from hashlib import sha256

DOMAIN = "family_dashboard_classroom"
CONF_CHILD_NAME = "child_name"

OAUTH_SCOPES = (
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
)

UPDATE_INTERVAL = timedelta(minutes=15)
MAX_ASSIGNMENT_ATTRIBUTES = 20


def has_exact_oauth_scopes(value: object) -> bool:
    """Accept exactly the two deliberately bounded Classroom scopes."""
    if not isinstance(value, str):
        return False
    granted = value.split()
    return len(granted) == len(OAUTH_SCOPES) and set(granted) == set(OAUTH_SCOPES)


def account_unique_id(account_id: str) -> str:
    """Keep Google's stable user ID out of persistent Home Assistant metadata."""
    return sha256(f"{DOMAIN}:{account_id}".encode()).hexdigest()
