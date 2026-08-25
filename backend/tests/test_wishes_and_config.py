"""Tests for new additions: anselma-heritage template, rich wedding default_config,
public wishes/guestbook endpoints, owner wishes endpoint."""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")


@pytest.fixture(scope="module")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


def _seed(mongo_db):
    uid = f"test-user-{uuid.uuid4().hex[:8]}"
    token = f"test_session_{uuid.uuid4().hex}"
    mongo_db.users.insert_one({
        "user_id": uid,
        "email": f"test.user.{uid}@example.com",
        "name": "TEST Wishes User",
        "picture": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return uid, token


@pytest.fixture(scope="module")
def sessions(mongo_db):
    """Two independent seeded users (owner + other) for ownership checks."""
    uid1, t1 = _seed(mongo_db)
    uid2, t2 = _seed(mongo_db)
    yield {"owner": {"user_id": uid1, "token": t1}, "other": {"user_id": uid2, "token": t2}}
    for uid, tok in ((uid1, t1), (uid2, t2)):
        mongo_db.users.delete_one({"user_id": uid})
        mongo_db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def owner_headers(sessions):
    return {"Authorization": f"Bearer {sessions['owner']['token']}"}


@pytest.fixture(scope="module")
def other_headers(sessions):
    return {"Authorization": f"Bearer {sessions['other']['token']}"}


@pytest.fixture(scope="module")
def wedding_event(owner_headers, mongo_db):
    """Create an anselma-heritage wedding event, publish it (free) so public routes work."""
    r = requests.post(f"{API}/events", headers=owner_headers, json={
        "title": "TEST Anselma Wedding",
        "event_type": "wedding",
        "template_id": "anselma-heritage",
    })
    assert r.status_code == 200, r.text
    e = r.json()
    requests.post(f"{API}/events/{e['event_id']}/publish-free", headers=owner_headers)
    yield e
    requests.delete(f"{API}/events/{e['event_id']}", headers=owner_headers)
    mongo_db.wishes.delete_many({"event_id": e["event_id"]})


# ---------------- Templates ----------------
def test_wedding_templates_include_anselma():
    r = requests.get(f"{API}/templates?category=wedding")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 8, [t["template_id"] for t in data]
    ids = [t["template_id"] for t in data]
    assert "anselma-heritage" in ids
    t = next(x for x in data if x["template_id"] == "anselma-heritage")
    assert t["name"] == "Anselma Heritage"
    assert t["category"] == "wedding"
    assert t["tier"] == "paid"
    assert t["cover"].startswith("http")
    assert set(["primary", "accent", "bg", "font_heading"]).issubset(t["theme"].keys())


# ---------------- New default wedding config ----------------
def test_wedding_default_config_new_fields(wedding_event, owner_headers):
    cfg = wedding_event["config"]
    for key in ["hashtag", "verse_text", "verse_ref", "bride_full_name", "groom_full_name",
                "bride_parents", "groom_parents", "bride_instagram", "groom_instagram"]:
        assert key in cfg, f"missing {key}"
    assert cfg["verse_ref"] == "Jeremiah 29:11"
    assert cfg["show_gift"] is True
    assert cfg["show_wishes"] is True

    assert isinstance(cfg["love_story"], list) and len(cfg["love_story"]) == 3
    for ch in cfg["love_story"]:
        assert set(["title", "date", "description", "photo"]).issubset(ch.keys())

    assert isinstance(cfg["events"], list) and len(cfg["events"]) == 2
    names = [ev["name"] for ev in cfg["events"]]
    assert "Akad Nikah" in names and "Resepsi" in names
    for ev in cfg["events"]:
        assert set(["name", "date", "time_start", "time_end", "venue", "address", "maps_url"]).issubset(ev.keys())

    assert isinstance(cfg["banks"], list) and len(cfg["banks"]) == 1
    assert cfg["banks"][0]["bank"] == "BCA"
    assert set(["bank", "account_number", "account_name"]).issubset(cfg["banks"][0].keys())

    # persisted via GET
    r = requests.get(f"{API}/events/{wedding_event['event_id']}", headers=owner_headers)
    assert r.status_code == 200
    assert r.json()["config"]["love_story"] == cfg["love_story"]
    assert "_id" not in r.json()


def test_patch_rich_config_persists(wedding_event, owner_headers):
    eid = wedding_event["event_id"]
    new_cfg = {
        "love_story": [{"title": "TEST Chapter", "date": "2020", "description": "d", "photo": "p.jpg"}],
        "banks": [
            {"bank": "Mandiri", "account_number": "999", "account_name": "TEST A"},
            {"bank": "BNI", "account_number": "888", "account_name": "TEST B"},
        ],
        "events": [{"name": "TEST Akad", "date": "2027-01-01", "time_start": "08:00",
                    "time_end": "09:00", "venue": "V", "address": "A",
                    "maps_url": "https://maps.google.com/?q=1"}],
        "hashtag": "#TESTWedding",
        "show_gift": False,
    }
    r = requests.patch(f"{API}/events/{eid}", headers=owner_headers, json={"config": new_cfg})
    assert r.status_code == 200, r.text
    cfg = r.json()["config"]
    assert len(cfg["love_story"]) == 1 and cfg["love_story"][0]["title"] == "TEST Chapter"
    assert len(cfg["banks"]) == 2 and cfg["banks"][1]["bank"] == "BNI"
    assert len(cfg["events"]) == 1 and cfg["events"][0]["maps_url"] == "https://maps.google.com/?q=1"
    assert cfg["hashtag"] == "#TESTWedding"
    assert cfg["show_gift"] is False

    # GET to verify persistence
    g = requests.get(f"{API}/events/{eid}", headers=owner_headers).json()
    assert g["config"]["banks"] == cfg["banks"]
    assert g["config"]["events"] == cfg["events"]
    # NOTE: PATCH replaces the whole config object (no server-side merge).
    # Frontend EventEditor always sends the full config so the app works, but a
    # partial API PATCH silently drops every other field. Documented here.
    assert "verse_ref" not in g["config"], "config merge behaviour changed - update this test"


def test_public_invitation_exposes_new_config(wedding_event):
    r = requests.get(f"{API}/public/inv/{wedding_event['slug']}")
    assert r.status_code == 200, r.text
    j = r.json()
    cfg = j["event"]["config"]
    assert "love_story" in cfg and "events" in cfg and "banks" in cfg
    assert j["event"]["template_id"] == "anselma-heritage"
    assert "user_id" not in j["event"]


# ---------------- Public wishes ----------------
def test_submit_wish_success(wedding_event):
    slug = wedding_event["slug"]
    r = requests.post(f"{API}/public/inv/{slug}/wishes",
                      json={"name": "TEST Budi", "message": "Congrats!", "attending": "attending"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["wish_id"].startswith("w_")
    assert j["name"] == "TEST Budi"
    assert j["message"] == "Congrats!"
    assert j["attending"] == "attending"
    assert isinstance(j["created_at"], str) and j["created_at"]
    assert "_id" not in j
    assert j["event_id"] == wedding_event["event_id"]


@pytest.mark.parametrize("payload", [
    {"name": "", "message": "hi"},
    {"name": "  ", "message": "hi"},
    {"name": "TEST X", "message": ""},
    {"name": "TEST X", "message": "   "},
])
def test_submit_wish_validation_400(wedding_event, payload):
    r = requests.post(f"{API}/public/inv/{wedding_event['slug']}/wishes", json=payload)
    assert r.status_code == 400, r.text


def test_submit_wish_invalid_attending_is_nulled(wedding_event):
    r = requests.post(f"{API}/public/inv/{wedding_event['slug']}/wishes",
                      json={"name": "TEST Nul", "message": "m", "attending": "bogus"})
    assert r.status_code == 200
    assert r.json()["attending"] is None


def test_submit_wish_missing_event_404():
    r = requests.post(f"{API}/public/inv/no-such-slug-xyz/wishes",
                      json={"name": "TEST", "message": "m"})
    assert r.status_code == 404


def test_list_wishes_sorted_desc(wedding_event):
    slug = wedding_event["slug"]
    names = ["TEST W1", "TEST W2", "TEST W3"]
    for n in names:
        r = requests.post(f"{API}/public/inv/{slug}/wishes", json={"name": n, "message": f"msg {n}"})
        assert r.status_code == 200
    r = requests.get(f"{API}/public/inv/{slug}/wishes")
    assert r.status_code == 200
    wishes = r.json()
    assert isinstance(wishes, list) and len(wishes) >= 3
    created = [w["created_at"] for w in wishes]
    assert created == sorted(created, reverse=True), created
    assert wishes[0]["name"] == "TEST W3"
    for w in wishes:
        assert "_id" not in w and "event_id" in w


def test_list_wishes_limit(wedding_event):
    r = requests.get(f"{API}/public/inv/{wedding_event['slug']}/wishes?limit=2")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_list_wishes_missing_event_404():
    r = requests.get(f"{API}/public/inv/no-such-slug-xyz/wishes")
    assert r.status_code == 404


# ---------------- Owner wishes ----------------
def test_owner_wishes_ok(wedding_event, owner_headers):
    r = requests.get(f"{API}/events/{wedding_event['event_id']}/wishes", headers=owner_headers)
    assert r.status_code == 200, r.text
    wishes = r.json()
    assert len(wishes) >= 4
    assert all(w["event_id"] == wedding_event["event_id"] for w in wishes)
    created = [w["created_at"] for w in wishes]
    assert created == sorted(created, reverse=True)


def test_owner_wishes_other_user_404(wedding_event, other_headers):
    r = requests.get(f"{API}/events/{wedding_event['event_id']}/wishes", headers=other_headers)
    assert r.status_code == 404


def test_owner_wishes_unauthenticated_401(wedding_event):
    r = requests.get(f"{API}/events/{wedding_event['event_id']}/wishes")
    assert r.status_code == 401


# ---------------- Cascade: wishes cleanup on event delete ----------------
def test_delete_event_removes_wishes(owner_headers, mongo_db):
    r = requests.post(f"{API}/events", headers=owner_headers, json={
        "title": "TEST Cascade Wedding", "event_type": "wedding", "template_id": "anselma-heritage"})
    e = r.json()
    requests.post(f"{API}/events/{e['event_id']}/publish-free", headers=owner_headers)
    requests.post(f"{API}/public/inv/{e['slug']}/wishes", json={"name": "TEST C", "message": "m"})
    assert mongo_db.wishes.count_documents({"event_id": e["event_id"]}) == 1
    d = requests.delete(f"{API}/events/{e['event_id']}", headers=owner_headers)
    assert d.status_code == 200
    remaining = mongo_db.wishes.count_documents({"event_id": e["event_id"]})
    mongo_db.wishes.delete_many({"event_id": e["event_id"]})
    assert remaining == 0, "wishes were not cascade-deleted with the event"
