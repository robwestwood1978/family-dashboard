"""School cycles, retained progress and parent edit boundaries."""
import importlib.util
from pathlib import Path
from datetime import date
import unittest

spec = importlib.util.spec_from_file_location("homework_model", Path(__file__).parent / "family_dashboard_homework/model.py")
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)


def profile(ident="child_one", reading=2):
    return {"id": ident, "name": "Child", "reading_day": reading, "reading_goal": 3,
            "spelling_day": 1, "homework_day": 1, "maths_set_day": 1, "maths_day": 4, "tables_goal": 3}


class HomeworkModelTest(unittest.TestCase):
    def setUp(self):
        self.today = date(2026, 10, 13)
        self.data = model.apply_admin(model.empty_data(), "profiles", {"profiles": [profile(), profile("child_two", 0)]})

    def log(self, kind="reading", when="2026-10-13", ident="first", **details):
        self.data = model.apply_progress(self.data, {"person_id": "child_one", "request_id": ident, "operation": "log", "kind": kind, "date": when, "details": details or {"book": "Example book"}}, self.today)

    def test_reading_cycle_ends_on_childs_return_day(self):
        self.log(when="2026-10-08", ident="thursday")
        self.log(when="2026-10-07", ident="previous_wednesday")
        child = model.client_data(self.data, self.today)["children"][0]
        reading = next(r for r in child["routines"] if r["kind"] == "reading")
        self.assertEqual((reading["due"], reading["count"]), ("2026-10-14", 1))
        next_cycle = model.client_data(self.data, date(2026,10,15))["children"][0]
        self.assertEqual(next(r for r in next_cycle["routines"] if r["kind"] == "reading")["count"], 0)
        self.assertEqual(len(next_cycle["logs"]), 2)

    def test_monday_return_stays_due_all_monday(self):
        self.assertEqual(model.next_due(date(2026,10,12),0).isoformat(),"2026-10-12")
        self.assertEqual(model.next_due(self.today,0).isoformat(),"2026-10-19")

    def test_maths_and_spelling_have_independent_deadlines(self):
        routines = model.client_data(self.data,self.today)["children"][0]["routines"]
        self.assertEqual(next(r for r in routines if r["kind"]=="spelling")["due"],"2026-10-13")
        self.assertEqual(next(r for r in routines if r["kind"]=="maths")["due"],"2026-10-16")

    def test_retry_is_idempotent_and_other_devices_merge(self):
        self.log(ident="one")
        self.log(ident="one")
        self.log(ident="two",book="Second book")
        self.assertEqual(len(self.data["logs"]),2)

    def test_plan_contents_do_not_roll_into_another_week(self):
        plan={"person_id":"child_one","kind":"spelling","title":"Weekly words","due":"2026-10-13","set_date":"2026-10-09","words":["cloud","matter"]}
        self.data=model.apply_admin(self.data,"publish",{"plan":plan})
        next_week=model.client_data(self.data,date(2026,10,14))["children"][0]
        routine=next(r for r in next_week["routines"] if r["kind"]=="spelling")
        self.assertEqual(routine["plan_ids"],[])
        self.assertEqual(next_week["plans"][0]["due"],"2026-10-13")

    def test_school_submission_separate_from_completion(self):
        self.data=model.apply_admin(self.data,"publish",{"plan":{"person_id":"child_one","kind":"maths","title":"Fractions","due":"2026-10-16"}})
        ident=self.data["plans"][0]["id"]
        self.data=model.apply_progress(self.data,{"person_id":"child_one","request_id":"finish","operation":"mark","target":ident,"field":"finished","value":True},self.today)
        self.assertEqual(self.data["marks"][ident],{"finished":True})

    def test_rejects_future_logs_unsafe_urls_and_cross_child_edits(self):
        with self.assertRaises(ValueError): self.log(when="2026-10-14")
        with self.assertRaises(ValueError): model.validate_plan({"person_id":"child_one","kind":"activity","title":"Activity","due":"2026-10-15","links":[{"url":"javascript:alert(1)"}]},self.data["profiles"])
        self.log()
        updated=model.apply_progress(self.data,{"person_id":"child_two","request_id":"other-child","operation":"remove_log","id":self.data["logs"][0]["id"]},self.today)
        self.assertEqual(len(updated["logs"]),1)

    def test_pause_inclusive_and_explicitly_resumes(self):
        self.data["profiles"][0]["paused_until"]="2026-10-13"
        self.assertEqual(model.client_data(self.data,self.today)["children"][0]["routines"],[])
        self.assertTrue(model.client_data(self.data,date(2026,10,14))["children"][0]["routines"])
        with self.assertRaises(ValueError): self.log()

    def test_duplicate_weekly_spelling_is_not_silently_overwritten(self):
        plan={"person_id":"child_one","kind":"spelling","title":"Words","due":"2026-10-13","words":["hello"]}
        self.data=model.apply_admin(self.data,"publish",{"plan":plan})
        with self.assertRaises(ValueError): model.apply_admin(self.data,"publish",{"plan":plan})

    def test_unfinished_homework_stays_visible_when_overdue(self):
        self.data=model.apply_admin(self.data,"publish",{"plan":{"person_id":"child_one","kind":"assignment","title":"School sheet","set_date":"2026-09-01","due":"2026-09-08"}})
        child=model.client_data(self.data,self.today)["children"][0]
        self.assertEqual(child["plans"][0]["title"],"School sheet")

if __name__ == "__main__": unittest.main()
