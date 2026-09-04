"""Pure tests for the bundled Family Dashboard Classroom provider."""

from __future__ import annotations

import importlib.util
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType
import unittest
from urllib.parse import urlsplit


def _load_provider_modules():
    integration_dir = Path(__file__).with_name("family_dashboard_classroom")
    package_name = "family_dashboard_classroom"
    package = ModuleType(package_name)
    package.__path__ = [str(integration_dir)]
    sys.modules[package_name] = package
    for module_name in ("const", "provider"):
        name = f"{package_name}.{module_name}"
        spec = importlib.util.spec_from_file_location(name, integration_dir / f"{module_name}.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        assert spec.loader is not None
        spec.loader.exec_module(module)
    return sys.modules[f"{package_name}.const"], sys.modules[f"{package_name}.provider"]


const, provider = _load_provider_modules()
TEST_ACCOUNT_ID = "123456789012345678901"


class FakeResponse:
    def __init__(self, payload=None, status=200):
        self.status = status
        self._payload = payload
        self.released = False

    async def json(self):
        return self._payload

    def release(self):
        self.released = True


class FakeSession:
    def __init__(self, routes):
        self.routes = {
            path: list(responses) if isinstance(responses, list) else [responses]
            for path, responses in routes.items()
        }
        self.requests = []

    async def async_request(self, method, url, **kwargs):
        path = urlsplit(url).path
        self.requests.append((method, path, tuple(kwargs.get("params", ()))))
        try:
            response = self.routes[path].pop(0)
        except (KeyError, IndexError) as err:
            raise AssertionError(f"Unexpected request for {path}") from err
        if isinstance(response, Exception):
            raise response
        return response


def course_work(
    identifier,
    title,
    day,
    *,
    link="https://classroom.google.com/c/example/a/example/details",
):
    return {
        "id": identifier,
        "title": title,
        "state": "PUBLISHED",
        "dueDate": {"year": 2026, "month": 9, "day": day},
        "dueTime": {"hours": 15, "minutes": 30},
        "alternateLink": link,
    }


def submission(identifier, state, *, account_id=TEST_ACCOUNT_ID, link=None):
    value = {"courseWorkId": identifier, "userId": account_id, "state": state}
    if link is not None:
        value["alternateLink"] = link
    return value


def one_course_routes(*, submission_state="NEW", account_id=TEST_ACCOUNT_ID):
    return {
        "/v1/courses": FakeResponse(
            {"courses": [{"id": "course", "name": "Course", "courseState": "ACTIVE"}]}
        ),
        "/v1/courses/course/courseWork": FakeResponse(
            {"courseWork": [course_work("work", "One task", 8)]}
        ),
        "/v1/courses/course/courseWork/-/studentSubmissions": FakeResponse(
            {"studentSubmissions": [submission("work", submission_state, account_id=account_id)]}
        ),
    }


class ClassroomProviderTests(unittest.IsolatedAsyncioTestCase):
    def test_sensor_registry_identity_uses_the_stable_hashed_account_id(self):
        sensor_source = (
            Path(__file__)
            .with_name("family_dashboard_classroom")
            .joinpath("sensor.py")
            .read_text(encoding="utf-8")
        )

        self.assertIn('f"{entry.unique_id}_open_assignments"', sensor_source)
        self.assertNotIn('f"{entry.entry_id}_open_assignments"', sensor_source)

    def test_preserves_a_date_only_deadline_without_timezone_rollover(self):
        self.assertEqual(
            provider._due_at({"dueDate": {"year": 2026, "month": 9, "day": 5}}),
            "2026-09-05",
        )

    def test_rejects_an_invalid_date_only_deadline(self):
        self.assertIsNone(
            provider._due_at({"dueDate": {"year": 2026, "month": 2, "day": 30}})
        )

    def test_scope_contract_is_exactly_two_read_only_scopes(self):
        self.assertEqual(
            const.OAUTH_SCOPES,
            (
                "https://www.googleapis.com/auth/classroom.courses.readonly",
                "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
            ),
        )
        self.assertTrue(const.has_exact_oauth_scopes(" ".join(reversed(const.OAUTH_SCOPES))))
        self.assertFalse(const.has_exact_oauth_scopes(const.OAUTH_SCOPES[0]))
        self.assertFalse(const.has_exact_oauth_scopes(f"{' '.join(const.OAUTH_SCOPES)} extra"))
        self.assertFalse(const.has_exact_oauth_scopes(None))

    def test_account_unique_id_is_stable_and_does_not_expose_google_id(self):
        unique_id = const.account_unique_id(TEST_ACCOUNT_ID)
        self.assertEqual(unique_id, const.account_unique_id(TEST_ACCOUNT_ID))
        self.assertNotIn(TEST_ACCOUNT_ID, unique_id)

    async def test_maps_open_and_complete_states_and_sorts_due_work(self):
        routes = {
            "/v1/courses": FakeResponse(
                {
                    "courses": [
                        {"id": "math", "name": "Mathematics", "courseState": "ACTIVE"},
                        {"id": "english", "name": "English", "courseState": "ACTIVE"},
                    ]
                }
            ),
            "/v1/courses/math/courseWork": FakeResponse(
                {
                    "courseWork": [
                        course_work("m1", "Fractions", 8),
                        course_work("m2", "Completed work", 6),
                        course_work("m3", "Algebra", 10),
                    ]
                }
            ),
            "/v1/courses/math/courseWork/-/studentSubmissions": FakeResponse(
                {
                    "studentSubmissions": [
                        submission("m1", "NEW"),
                        submission("m2", "TURNED_IN"),
                        submission("m3", "CREATED"),
                    ]
                }
            ),
            "/v1/courses/english/courseWork": FakeResponse(
                {
                    "courseWork": [
                        course_work("e1", "Book review", 7, link="https://not-google.invalid/work"),
                        course_work("e2", "Returned work", 5),
                    ]
                }
            ),
            "/v1/courses/english/courseWork/-/studentSubmissions": FakeResponse(
                {
                    "studentSubmissions": [
                        submission(
                            "e1",
                            "RECLAIMED_BY_STUDENT",
                            link="https://classroom.google.com/c/example/a/review/details",
                        ),
                        submission("e2", "RETURNED"),
                    ]
                }
            ),
        }
        session = FakeSession(routes)
        reader = provider.ClassroomProvider(
            session,
            clock=lambda: datetime(2026, 9, 4, 12, tzinfo=UTC),
        )

        data = await reader.async_fetch()

        self.assertEqual(data.account_id, TEST_ACCOUNT_ID)
        self.assertEqual(data.open_count, 3)
        self.assertEqual(
            [item.title for item in data.assignments],
            ["Book review", "Fractions", "Algebra"],
        )
        self.assertEqual(
            data.assignments[0].alternate_link,
            "https://classroom.google.com/c/example/a/review/details",
        )
        self.assertEqual(data.assignments[1].due_at, "2026-09-08T15:30:00Z")
        self.assertEqual(data.fetched_at, "2026-09-04T12:00:00Z")
        self.assertFalse(data.stale)
        self.assertTrue(all(request[0] == "GET" for request in session.requests))
        submission_params = next(
            params for _, path, params in session.requests if path.endswith("studentSubmissions")
        )
        self.assertIn(("userId", "me"), submission_params)
        self.assertNotIn(("userId", "-"), submission_params)

    async def test_caps_assignment_attributes_at_twenty_without_hiding_count(self):
        work = [
            course_work(f"w{index}", f"Work {index:02d}", (index % 20) + 1)
            for index in range(25)
        ]
        submissions = [
            submission(f"w{index}", "NEW")
            for index in range(25)
        ]
        session = FakeSession(
            {
                "/v1/courses": FakeResponse(
                    {"courses": [{"id": "course", "name": "Course", "courseState": "ACTIVE"}]}
                ),
                "/v1/courses/course/courseWork": FakeResponse({"courseWork": work}),
                "/v1/courses/course/courseWork/-/studentSubmissions": FakeResponse(
                    {"studentSubmissions": submissions}
                ),
            }
        )

        data = await provider.ClassroomProvider(session).async_fetch()

        self.assertEqual(data.open_count, 25)
        self.assertEqual(len(data.assignments), 20)
        self.assertTrue(data.assignments_truncated)

    async def test_paginates_with_a_bounded_page_token(self):
        session = FakeSession(
            {
                "/v1/courses": [
                    FakeResponse(
                        {
                            "courses": [
                                {
                                    "id": "archived",
                                    "name": "Old",
                                    "courseState": "ARCHIVED",
                                }
                            ],
                            "nextPageToken": "page-two",
                        }
                    ),
                    FakeResponse(
                        {"courses": [{"id": "course", "name": "Course", "courseState": "ACTIVE"}]}
                    ),
                ],
                "/v1/courses/course/courseWork": FakeResponse(
                    {"courseWork": [course_work("work", "Completed work", 8)]}
                ),
                "/v1/courses/course/courseWork/-/studentSubmissions": FakeResponse(
                    {"studentSubmissions": [submission("work", "TURNED_IN")]}
                ),
            }
        )

        data = await provider.ClassroomProvider(session).async_fetch()

        self.assertEqual(data.open_count, 0)
        self.assertIn(("pageToken", "page-two"), session.requests[1][2])

    async def test_rejects_unknown_submission_states_instead_of_undercounting(self):
        session = FakeSession(one_course_routes(submission_state="FUTURE_STATE"))

        with self.assertRaisesRegex(provider.ClassroomApiError, "unknown submission state"):
            await provider.ClassroomProvider(session).async_fetch()

    async def test_requires_one_consistent_account_identity(self):
        no_identity = one_course_routes()
        no_identity["/v1/courses/course/courseWork/-/studentSubmissions"] = FakeResponse(
            {"studentSubmissions": []}
        )
        with self.assertRaises(provider.ClassroomIdentityUnavailable):
            await provider.ClassroomProvider(FakeSession(no_identity)).async_fetch()

        inconsistent = one_course_routes()
        inconsistent["/v1/courses/course/courseWork"] = FakeResponse(
            {"courseWork": [course_work("one", "One", 8), course_work("two", "Two", 9)]}
        )
        inconsistent["/v1/courses/course/courseWork/-/studentSubmissions"] = FakeResponse(
            {
                "studentSubmissions": [
                    submission("one", "NEW", account_id="111"),
                    submission("two", "NEW", account_id="222"),
                ]
            }
        )
        with self.assertRaisesRegex(provider.ClassroomApiError, "inconsistent account data"):
            await provider.ClassroomProvider(FakeSession(inconsistent)).async_fetch()

    async def test_401_triggers_auth_error_without_exposing_response_body(self):
        session = FakeSession({"/v1/courses": FakeResponse({"token": "secret"}, status=401)})

        with self.assertRaisesRegex(
            provider.ClassroomAuthError, "authorization needs attention"
        ) as caught:
            await provider.ClassroomProvider(session).async_fetch()

        self.assertNotIn("secret", str(caught.exception))

    async def test_transient_failure_returns_a_marked_last_good_result(self):
        good_session = FakeSession(one_course_routes())
        feed = provider.LastGoodClassroomFeed(provider.ClassroomProvider(good_session))
        first = await feed.async_fetch()
        self.assertFalse(first.stale)

        feed._provider = provider.ClassroomProvider(  # pylint: disable=protected-access
            FakeSession({"/v1/courses": FakeResponse({}, status=503)})
        )
        cached = await feed.async_fetch()

        self.assertTrue(cached.stale)
        self.assertEqual(cached.open_count, first.open_count)
        self.assertEqual(cached.assignments, first.assignments)
        self.assertEqual(cached.last_error, "Google Classroom returned HTTP 503")

    async def test_auth_failure_never_hides_behind_last_good_data(self):
        feed = provider.LastGoodClassroomFeed(
            provider.ClassroomProvider(FakeSession(one_course_routes()))
        )
        await feed.async_fetch()
        feed._provider = provider.ClassroomProvider(  # pylint: disable=protected-access
            FakeSession({"/v1/courses": FakeResponse({}, status=401)})
        )

        with self.assertRaises(provider.ClassroomAuthError):
            await feed.async_fetch()


if __name__ == "__main__":
    unittest.main()
