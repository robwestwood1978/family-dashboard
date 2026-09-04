"""Bounded, read-only Google Classroom REST provider.

This module intentionally has no Home Assistant imports so its parsing, state
classification and failure behaviour can be tested without a running Home
Assistant instance.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime
import re
from typing import Any, Protocol
from urllib.parse import quote

from .const import MAX_ASSIGNMENT_ATTRIBUTES

API_ROOT = "https://classroom.googleapis.com/v1"
REQUEST_TIMEOUT_SECONDS = 20
MAX_COURSES = 100
MAX_ITEMS_PER_COLLECTION = 500
MAX_PAGES = 5
MAX_CONCURRENT_COURSES = 4

OPEN_SUBMISSION_STATES = frozenset({"NEW", "CREATED", "RECLAIMED_BY_STUDENT"})
COMPLETE_SUBMISSION_STATES = frozenset(
    {"TURNED_IN", "RETURNED", "STUDENT_EDITED_AFTER_TURN_IN"}
)


class OAuthSession(Protocol):
    """Subset of Home Assistant's OAuth2Session used by this provider."""

    async def async_request(self, method: str, url: str, **kwargs: Any) -> Any:
        """Make an authenticated request."""


class ClassroomAuthError(Exception):
    """The Classroom authorization is no longer accepted."""


class ClassroomApiError(Exception):
    """Classroom could not provide a complete bounded result."""


class ClassroomIdentityUnavailable(ClassroomApiError):
    """Classroom has no submission from which to bind the signed-in account."""


@dataclass(frozen=True, slots=True)
class ClassroomAssignment:
    """One open assignment exposed to the dashboard."""

    title: str
    course: str
    due_at: str | None
    alternate_link: str | None

    def as_attribute(self) -> dict[str, str | None]:
        """Return the deliberately small public sensor representation."""
        return {
            "title": self.title,
            "course": self.course,
            "due_at": self.due_at,
            "alternate_link": self.alternate_link,
        }


@dataclass(frozen=True, slots=True)
class ClassroomData:
    """A complete poll result or a marked last-good copy."""

    account_id: str
    open_count: int
    assignments: tuple[ClassroomAssignment, ...]
    assignments_truncated: bool
    fetched_at: str
    stale: bool = False
    last_error: str | None = None


def _bounded_text(value: Any, fallback: str, limit: int) -> str:
    if not isinstance(value, str):
        return fallback
    cleaned = " ".join(value.split())
    return cleaned[:limit] or fallback


def _safe_classroom_link(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) > 1_000:
        return None
    if not value.startswith("https://classroom.google.com/"):
        return None
    return value


def _due_at(course_work: Mapping[str, Any]) -> str | None:
    due_date = course_work.get("dueDate")
    if not isinstance(due_date, Mapping):
        return None
    try:
        year = int(due_date["year"])
        month = int(due_date["month"])
        day = int(due_date["day"])
        date_only = datetime(year, month, day, tzinfo=UTC)
        due_time = course_work.get("dueTime")
        if isinstance(due_time, Mapping):
            hour = int(due_time.get("hours", 0))
            minute = int(due_time.get("minutes", 0))
            second = int(due_time.get("seconds", 0))
        else:
            # Preserve a date-only deadline as a date. Converting it to a UTC
            # instant can move the displayed school date across a timezone boundary.
            return date_only.strftime("%Y-%m-%d")
        return (
            datetime(year, month, day, hour, minute, second, tzinfo=UTC)
            .isoformat()
            .replace("+00:00", "Z")
        )
    except (KeyError, TypeError, ValueError):
        return None


def _assignment_sort_key(assignment: ClassroomAssignment) -> tuple[int, str, str, str]:
    return (
        1 if assignment.due_at is None else 0,
        assignment.due_at or "",
        assignment.course.casefold(),
        assignment.title.casefold(),
    )


class ClassroomProvider:
    """Read a child's active Classroom courses and open submissions."""

    def __init__(
        self,
        session: OAuthSession,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._session = session
        self._clock = clock

    async def _async_json(
        self,
        path: str,
        params: Sequence[tuple[str, str]],
    ) -> Mapping[str, Any]:
        try:
            response = await self._session.async_request(
                "GET",
                f"{API_ROOT}/{path}",
                params=list(params),
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except Exception as err:
            raise ClassroomApiError("Google Classroom is temporarily unavailable") from err

        try:
            status = getattr(response, "status", 0)
            if status == 401:
                raise ClassroomAuthError("Google Classroom authorization needs attention")
            if status < 200 or status >= 300:
                raise ClassroomApiError(f"Google Classroom returned HTTP {status or 'unknown'}")
            payload = await response.json()
            if not isinstance(payload, Mapping):
                raise ClassroomApiError("Google Classroom returned an invalid response")
            return payload
        except (ClassroomAuthError, ClassroomApiError):
            raise
        except Exception as err:
            raise ClassroomApiError("Google Classroom returned an invalid response") from err
        finally:
            release = getattr(response, "release", None)
            if callable(release):
                release()

    async def _async_paginated(
        self,
        path: str,
        collection_key: str,
        params: Sequence[tuple[str, str]],
        *,
        max_items: int,
    ) -> list[Mapping[str, Any]]:
        items: list[Mapping[str, Any]] = []
        page_token: str | None = None
        seen_tokens: set[str] = set()

        for _ in range(MAX_PAGES):
            page_params = list(params)
            if page_token is not None:
                page_params.append(("pageToken", page_token))
            payload = await self._async_json(path, page_params)
            page_items = payload.get(collection_key, [])
            if not isinstance(page_items, list) or any(
                not isinstance(item, Mapping) for item in page_items
            ):
                raise ClassroomApiError("Google Classroom returned an invalid collection")
            items.extend(page_items)
            if len(items) > max_items:
                raise ClassroomApiError(
                    "Google Classroom returned more data than the bounded reader accepts"
                )
            next_token = payload.get("nextPageToken")
            if next_token in (None, ""):
                return items
            if not isinstance(next_token, str) or next_token in seen_tokens:
                raise ClassroomApiError("Google Classroom returned an invalid page token")
            seen_tokens.add(next_token)
            page_token = next_token

        raise ClassroomApiError("Google Classroom exceeded the bounded page limit")

    async def _async_course_assignments(
        self,
        course: Mapping[str, Any],
        semaphore: asyncio.Semaphore,
    ) -> tuple[list[ClassroomAssignment], set[str]]:
        course_id = _bounded_text(course.get("id"), "", 160)
        if not course_id:
            raise ClassroomApiError("Google Classroom returned a course without an identifier")
        course_name = _bounded_text(course.get("name"), "Classroom", 160)
        encoded_course_id = quote(course_id, safe="")

        async with semaphore:
            course_work_task = self._async_paginated(
                f"courses/{encoded_course_id}/courseWork",
                "courseWork",
                (
                    ("courseWorkStates", "PUBLISHED"),
                    ("orderBy", "dueDate asc,updateTime desc"),
                    ("pageSize", "100"),
                    (
                        "fields",
                        "nextPageToken,courseWork(id,title,dueDate,dueTime,alternateLink,state)",
                    ),
                ),
                max_items=MAX_ITEMS_PER_COLLECTION,
            )
            submissions_task = self._async_paginated(
                f"courses/{encoded_course_id}/courseWork/-/studentSubmissions",
                "studentSubmissions",
                (
                    ("userId", "me"),
                    ("pageSize", "100"),
                    (
                        "fields",
                        "nextPageToken,studentSubmissions(courseWorkId,userId,state,late,alternateLink)",
                    ),
                ),
                max_items=MAX_ITEMS_PER_COLLECTION,
            )
            course_work, submissions = await asyncio.gather(course_work_task, submissions_task)

        work_by_id = {
            item.get("id"): item
            for item in course_work
            if isinstance(item.get("id"), str) and item.get("state", "PUBLISHED") == "PUBLISHED"
        }
        assignments: list[ClassroomAssignment] = []
        account_ids: set[str] = set()
        seen_work_ids: set[str] = set()
        for submission in submissions:
            account_id = submission.get("userId")
            if not isinstance(account_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", account_id):
                raise ClassroomApiError("Google Classroom returned incomplete account data")
            account_ids.add(account_id)
            state = submission.get("state")
            if state in COMPLETE_SUBMISSION_STATES:
                continue
            if state not in OPEN_SUBMISSION_STATES:
                raise ClassroomApiError("Google Classroom returned an unknown submission state")
            work_id = submission.get("courseWorkId")
            if not isinstance(work_id, str) or work_id in seen_work_ids:
                continue
            work = work_by_id.get(work_id)
            if work is None:
                # A submission without its corresponding published work cannot
                # be rendered truthfully, so fail the complete poll rather than
                # silently under-counting it.
                raise ClassroomApiError("Google Classroom returned incomplete coursework data")
            seen_work_ids.add(work_id)
            assignments.append(
                ClassroomAssignment(
                    title=_bounded_text(work.get("title"), "Assignment", 300),
                    course=course_name,
                    due_at=_due_at(work),
                    alternate_link=_safe_classroom_link(work.get("alternateLink"))
                    or _safe_classroom_link(submission.get("alternateLink")),
                )
            )
        return assignments, account_ids

    async def async_fetch(self) -> ClassroomData:
        """Return the complete bounded open-assignment sensor payload."""
        courses = await self._async_paginated(
            "courses",
            "courses",
            (
                ("studentId", "me"),
                ("courseStates", "ACTIVE"),
                ("pageSize", "100"),
                ("fields", "nextPageToken,courses(id,name,courseState)"),
            ),
            max_items=MAX_COURSES,
        )
        active_courses = [
            course
            for course in courses
            if course.get("courseState", "ACTIVE") == "ACTIVE"
        ]
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_COURSES)
        per_course = await asyncio.gather(
            *(self._async_course_assignments(course, semaphore) for course in active_courses)
        )
        account_ids = {
            account_id
            for _, course_account_ids in per_course
            for account_id in course_account_ids
        }
        if not account_ids:
            raise ClassroomIdentityUnavailable(
                "Google Classroom cannot confirm this account until it has assigned coursework"
            )
        if len(account_ids) != 1:
            raise ClassroomApiError("Google Classroom returned inconsistent account data")
        assignments = sorted(
            (assignment for course_assignments, _ in per_course for assignment in course_assignments),
            key=_assignment_sort_key,
        )
        open_count = len(assignments)
        return ClassroomData(
            account_id=next(iter(account_ids)),
            open_count=open_count,
            assignments=tuple(assignments[:MAX_ASSIGNMENT_ATTRIBUTES]),
            assignments_truncated=open_count > MAX_ASSIGNMENT_ATTRIBUTES,
            fetched_at=self._clock().astimezone(UTC).isoformat().replace("+00:00", "Z"),
        )


class LastGoodClassroomFeed:
    """Preserve the last complete result through transient provider failures."""

    def __init__(self, provider: ClassroomProvider) -> None:
        self._provider = provider
        self._last_good: ClassroomData | None = None

    async def async_fetch(self) -> ClassroomData:
        try:
            data = await self._provider.async_fetch()
        except ClassroomAuthError:
            # Authentication errors must trigger Home Assistant reauth and may
            # not be hidden behind cached data.
            raise
        except ClassroomApiError as err:
            if self._last_good is None:
                raise
            return replace(self._last_good, stale=True, last_error=str(err)[:160])
        self._last_good = data
        return data
