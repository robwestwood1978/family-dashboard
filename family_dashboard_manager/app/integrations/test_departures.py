"""School clock rules and production runtime tested without a HA installation."""
import ast
import asyncio
from copy import deepcopy
from datetime import datetime
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlparse, urlencode
from zoneinfo import ZoneInfo

ROOT=Path(__file__).parent/"family_dashboard_departures"
spec=importlib.util.spec_from_file_location("departures_model",ROOT/"model.py")
model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)
TZ=ZoneInfo("Europe/London")

def now(value="2026-10-20T07:15:00"):
    return datetime.fromisoformat(value).replace(tzinfo=TZ)

def configured():
    data=model.empty_data()
    data["settings"].update({"enabled":True,"times":["08:15","07:35","08:15","08:15","08:15",None,None],"speakers":["media_player.kitchen"],"tts_entity":"tts.example_voice"})
    return data

class DepartureRules(unittest.TestCase):
    def test_weekdays_and_weekends(self):
        for day,value in [(19,"08:15"),(20,"07:35"),(21,"08:15"),(22,"08:15"),(23,"08:15")]:
            self.assertEqual(model.departure_target(configured(),now(f"2026-10-{day}T06:00:00")).strftime("%H:%M"),value)
        self.assertIsNone(model.departure_target(configured(),now("2026-10-24T07:00:00")))

    def test_dst_preserves_local_school_time(self):
        summer=model.departure_target(configured(),now("2026-10-23T07:00:00"))
        winter=model.departure_target(configured(),now("2026-10-26T07:00:00"))
        self.assertEqual(summer.strftime("%H:%M"),winter.strftime("%H:%M"))
        self.assertEqual(summer.utcoffset().total_seconds(),3600)
        self.assertEqual(winter.utcoffset().total_seconds(),0)

    def test_warning_windows_do_not_replay_a_backlog(self):
        for timestamp,minutes in [("07:15:00",20),("07:15:19",20),("07:25:00",10),("07:30:00",5),("07:35:10",0)]:
            self.assertEqual(model.due_reminder(configured(),now(f"2026-10-20T{timestamp}")),minutes)
        for timestamp in ["07:14:59","07:15:21","07:24:00","07:36:00"]:
            self.assertIsNone(model.due_reminder(configured(),now(f"2026-10-20T{timestamp}")))

    def test_claims_survive_restart_and_time_changes(self):
        data=model.claim_reminder(configured(),20,now())
        self.assertIsNone(model.due_reminder(deepcopy(data),now("2026-10-20T07:15:05")))
        data=model.apply_today(data,{"operation":"override","date":"2026-10-20","time":"08:00","mode":"walk"},now())
        self.assertIsNone(model.due_reminder(data,now("2026-10-20T07:40:00")))
        self.assertEqual(data["settings"]["times"][1],"07:35")
        self.assertEqual(model.client_data(data,now())["mode"],"walk")
        tomorrow=model.client_data(data,now("2026-10-21T07:15:00"))
        self.assertEqual(tomorrow["time"],"08:15");self.assertFalse(tomorrow["overridden"])

    def test_pause_mute_skip_and_left_prevent_sound(self):
        for operation in ["left","skip","mute"]:
            payload={"operation":operation,"date":"2026-10-20"}
            if operation=="mute":payload["muted"]=True
            self.assertIsNone(model.due_reminder(model.apply_today(configured(),payload,now()),now()))
        data=configured();data["settings"]["paused_until"]="2026-10-20"
        self.assertIsNone(model.departure_target(data,now()))
        self.assertIsNotNone(model.departure_target(data,now("2026-10-21T07:00:00")))
        data["settings"]["enabled"]=False
        self.assertIsNone(model.departure_target(data,now("2026-10-21T07:00:00")))

    def test_invalid_or_stale_daily_actions_are_rejected(self):
        for payload in [{"operation":"left","date":"2026-10-19"},{"operation":"override","date":"2026-10-20","time":"25:00","mode":"walk"},{"operation":"override","date":"2026-10-20","time":"08:00","mode":"flight"},{"operation":"left","date":"2026-10-20","entity_id":"media_player.other"}]:
            with self.assertRaises(ValueError):model.apply_today(configured(),payload,now())

    def test_bad_settings_cannot_expand_announcement_access(self):
        for key,value in [("volume",100),("volume",True),("tts_entity","https://example.com/speech"),("speakers",["lock.front"]),("reminders",[20,20]),("reminders",[True]),("times",["08:00"]),("paused_until","2026-02-31"),("secret","rejected")]:
            settings=deepcopy(configured()["settings"]);settings[key]=value
            with self.assertRaises(ValueError):model.validate_settings(settings)
        self.assertEqual(model.validate_settings(configured()["settings"])["reminders"],[20,10,5,0])

    def test_countdown_window_and_retention(self):
        data=configured()
        self.assertFalse(model.client_data(data,now("2026-10-20T06:00:00"))["visible"])
        self.assertTrue(model.client_data(data,now())["visible"])
        self.assertFalse(model.client_data(data,now("2026-10-20T09:00:00"))["visible"])
        data["days"]={"2026-09-01":{"left":True},"2026-10-19":{"left":True}}
        result=model.apply_today(data,{"operation":"left","date":"2026-10-20"},now())
        self.assertNotIn("2026-09-01",result["days"]);self.assertIn("2026-10-19",result["days"])

# Run the actual runtime class and WS handler with only HA adapters substituted.
def runtime_fixture():
    class MemoryStore:
        def __init__(self,*args,**kwargs):self.saved=[];self.fail=False
        async def async_save(self,value):
            if self.fail:raise OSError("disk full")
            self.saved.append(deepcopy(value))
        async def async_load(self):return None
    records={"media_player.kitchen":SimpleNamespace(platform="sonos",disabled_by=None),"tts.example_voice":SimpleNamespace(platform="piper",disabled_by=None)}
    clock=SimpleNamespace(value=now());clock.now=lambda:clock.value;clock.utcnow=lambda:clock.value
    hass=SimpleNamespace(data={},states=SimpleNamespace(async_set=lambda *a:None,get=lambda key:SimpleNamespace(state="unknown" if key.startswith("tts.") else "idle")),services=SimpleNamespace(async_call=AsyncMock()))
    namespace={**{k:getattr(model,k) for k in ["announcement_message","apply_settings","apply_today","claim_reminder","client_data","due_reminder","empty_data","validate_settings"]},"asyncio":asyncio,"deepcopy":deepcopy,"Store":MemoryStore,"ENTITY":"sensor.family_dashboard_departure","DOMAIN":"family_dashboard_departures","TEST_MESSAGE":"This is a test of your school departure reminders.","er":SimpleNamespace(async_get=lambda _:SimpleNamespace(async_get=lambda key:records.get(key))),"dt_util":clock,"urlencode":urlencode}
    module=ast.parse((ROOT/"__init__.py").read_text())
    selected=[n for n in module.body if isinstance(n,ast.ClassDef) and n.name=="DepartureStore" or isinstance(n,ast.AsyncFunctionDef) and n.name=="update_today"]
    for node in selected:node.decorator_list=[]
    exec(compile(ast.Module(body=selected,type_ignores=[]),"departure_runtime","exec"),namespace)
    runtime=namespace["DepartureStore"](hass);runtime.data=configured();hass.data[namespace["DOMAIN"]]=runtime
    return runtime,hass,clock,records,namespace

class DepartureRuntime(unittest.IsolatedAsyncioTestCase):
    async def test_claim_is_durable_before_one_bounded_announcement(self):
        runtime,hass,*_=runtime_fixture()
        async def play(*args,**kwargs):self.assertIn("20",runtime.store.saved[-1]["data"]["days"]["2026-10-20"]["sent"])
        hass.services.async_call.side_effect=play
        await asyncio.gather(runtime.tick(),runtime.tick())
        self.assertEqual(hass.services.async_call.call_count,1)
        args=hass.services.async_call.call_args.args;self.assertEqual(args[:2],("media_player","play_media"))
        payload=args[2];self.assertEqual(payload["entity_id"],["media_player.kitchen"]);self.assertTrue(payload["announce"]);self.assertEqual(payload["extra"],{"volume":20})
        uri=urlparse(payload["media_content_id"]);self.assertEqual((uri.scheme,uri.netloc,uri.path),("media-source","tts","/tts.example_voice"))
        self.assertEqual(parse_qs(uri.query)["message"],[model.announcement_message(20)])
        await runtime.tick();self.assertEqual(hass.services.async_call.call_count,1)
        self.assertEqual(runtime.data["last_announcement"]["status"],"sent")

    async def test_storage_failure_never_plays_and_audio_failure_never_loops(self):
        runtime,hass,*_=runtime_fixture();runtime.store.fail=True
        await runtime.tick();hass.services.async_call.assert_not_called()
        runtime.store.fail=False;hass.services.async_call.side_effect=RuntimeError("speaker unavailable")
        await runtime.tick();await runtime.tick()
        self.assertEqual(hass.services.async_call.call_count,1);self.assertEqual(runtime.data["last_announcement"]["status"],"failed")

    async def test_remapped_speaker_stale_admin_and_custom_test_message_fail(self):
        runtime,hass,clock,records,namespace=runtime_fixture();records["media_player.kitchen"].platform="other"
        await runtime.tick();hass.services.async_call.assert_not_called()
        with self.assertRaises(ValueError):await runtime.admin({"operation":"settings","expected_revision":-1,"payload":runtime.data["settings"]})
        with self.assertRaises(ValueError):await runtime.admin({"operation":"test","expected_revision":runtime.data["revision"],"payload":{"message":"arbitrary"}})

    async def test_child_cannot_cancel_or_change_departure(self):
        runtime,hass,clock,records,namespace=runtime_fixture();errors=[]
        connection=SimpleNamespace(user=SimpleNamespace(is_admin=False),send_error=lambda *args:errors.append(args))
        await namespace["update_today"](hass,connection,{"id":1,"payload":{"operation":"left","date":"2026-10-20"},"expected_revision":0})
        self.assertEqual(errors[0][1],"unauthorized");self.assertEqual(runtime.data["revision"],0);hass.services.async_call.assert_not_called()

if __name__=="__main__":unittest.main()
