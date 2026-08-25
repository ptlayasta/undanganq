"""Tests for iteration: 10 event types, 21 templates, ornaments, section toggles,
wish->RSVP cascade, Xendit payment config / mock checkout."""
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

SECTION_FLAGS = ["show_cover", "show_verse", "show_couple", "show_love_story", "show_gallery",
                 "show_video", "show_countdown", "show_events", "show_gift", "show_rsvp", "show_wishes"]

EXPECTED_TYPES = ["wedding", "engagement", "aqiqah", "khitanan", "birthday", "graduation",
                  "anniversary", "baby_shower", "syukuran", "corporate"]


@pytest.fixture(scope="module")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="module")
def session(mongo_db):
    uid = f"test-user-{uuid.uuid4().hex[:8]}"
    token = f"test_session_{uuid.uuid4().hex}"
    mongo_db.users.insert_one({
        "user_id": uid, "email": f"test.user.{uid}@example.com", "name": "TEST NewFeat",
        "picture": "", "created_at": datetime.now(timezone.utc).isoformat()})
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)})
    yield {"user_id": uid, "token": token}
    mongo_db.users.delete_one({"user_id": uid})
    mongo_db.user_sessions.delete_one({"session_token": token})


@pytest.fixture(scope="module")
def headers(session):
    return {"Authorization": f"Bearer {session['token']}"}


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(headers, created_ids, mongo_db):
    yield
    for eid in created_ids:
        requests.delete(f"{API}/events/{eid}", headers=headers)
        mongo_db.wishes.delete_many({"event_id": eid})


# ---------------- Event types ----------------
def test_event_types_ten_in_order():
    r = requests.get(f"{API}/event-types")
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data) == 10, data
    assert [d["key"] for d in data] == EXPECTED_TYPES
    assert all(d.get("label") for d in data)


# ---------------- Templates ----------------
def test_templates_21_all_categories():
    r = requests.get(f"{API}/templates")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 21, len(data)
    cats = {t["category"] for t in data}
    assert cats == set(EXPECTED_TYPES), cats
    ids = [t["template_id"] for t in data]
    assert len(set(ids)) == 21, "duplicate template_ids"
    for t in data:
        assert t["tier"] in ("free", "paid")
        assert t["cover"].startswith("http")
        assert t["theme"].get("ornament") in ("floral", "botanical", "geometric"), t


@pytest.mark.parametrize("category", EXPECTED_TYPES)
def test_templates_filter_per_category(category):
    r = requests.get(f"{API}/templates?category={category}")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1, f"no templates for {category}"
    assert all(t["category"] == category for t in data)


# ---------------- Payment config ----------------
def test_payment_config_mocked():
    r = requests.get(f"{API}/payment/config")
    assert r.status_code == 200
    assert r.json() == {"provider": "xendit", "mode": "mocked"}


# ---------------- Default configs per new event type ----------------
def _create(headers, created_ids, event_type, template_id, title):
    r = requests.post(f"{API}/events", headers=headers,
                      json={"title": title, "event_type": event_type, "template_id": template_id})
    assert r.status_code == 200, r.text
    e = r.json()
    created_ids.append(e["event_id"])
    return e


@pytest.mark.parametrize("event_type,template_id", [
    ("engagement", "engagement-rose"),
    ("khitanan", "khitanan-classic"),
    ("graduation", "graduation-honor"),
    ("anniversary", "anniversary-forever"),
    ("baby_shower", "baby-shower-cloud"),
    ("syukuran", "syukuran-heartfelt"),
    ("corporate", "corporate-elegant"),
])
def test_new_event_type_defaults(headers, created_ids, event_type, template_id):
    e = _create(headers, created_ids, event_type, template_id, f"TEST {event_type}")
    cfg = e["config"]
    assert e["event_type"] == event_type
    assert cfg["ornament_set"] == "floral"
    for f in SECTION_FLAGS:
        assert f in cfg, f"missing flag {f} for {event_type}"
        assert isinstance(cfg[f], bool)
    assert isinstance(cfg.get("events"), list) and len(cfg["events"]) >= 1

    if event_type == "engagement":
        assert cfg["bride_name"] and cfg["groom_name"]
        assert cfg["show_love_story"] is False
    if event_type == "graduation":
        assert cfg["graduate_name"] and cfg["degree"] and cfg["university"]
    if event_type == "corporate":
        assert cfg["company_name"] and cfg["event_name"]
    if event_type == "baby_shower":
        assert cfg["mother_name"] and cfg["father_name"] and cfg["due_date"]
    if event_type == "anniversary":
        assert cfg["years"]
    if event_type == "syukuran":
        assert cfg["host_name"] and cfg["occasion"]
    if event_type == "khitanan":
        assert cfg["child_name"] and cfg["parents"]

    # persistence
    g = requests.get(f"{API}/events/{e['event_id']}", headers=headers)
    assert g.status_code == 200
    assert g.json()["config"] == cfg
    assert "_id" not in g.json()


# ---------------- Section toggles + ornament PATCH ----------------
def test_patch_section_toggles_and_ornament(headers, created_ids):
    e = _create(headers, created_ids, "wedding", "elegant-rose", "TEST Toggles")
    eid = e["event_id"]
    new_cfg = {**e["config"], "show_gallery": False, "show_wishes": False, "ornament_set": "geometric"}
    r = requests.patch(f"{API}/events/{eid}", headers=headers, json={"config": new_cfg})
    assert r.status_code == 200, r.text
    cfg = r.json()["config"]
    assert cfg["show_gallery"] is False
    assert cfg["show_wishes"] is False
    assert cfg["ornament_set"] == "geometric"
    assert cfg["show_cover"] is True

    g = requests.get(f"{API}/events/{eid}", headers=headers).json()["config"]
    assert g["show_gallery"] is False and g["show_wishes"] is False
    assert g["ornament_set"] == "geometric"


def test_public_invitation_exposes_toggles_and_ornament(headers, created_ids):
    e = _create(headers, created_ids, "wedding", "batik-heritage", "TEST Public Toggles")
    eid = e["event_id"]
    requests.patch(f"{API}/events/{eid}", headers=headers,
                   json={"config": {**e["config"], "show_video": False, "ornament_set": "botanical"}})
    requests.post(f"{API}/events/{eid}/publish-free", headers=headers)
    slug = requests.get(f"{API}/events/{eid}", headers=headers).json()["slug"]
    r = requests.get(f"{API}/public/inv/{slug}")
    assert r.status_code == 200, r.text
    cfg = r.json()["event"]["config"]
    assert cfg["show_video"] is False
    assert cfg["ornament_set"] == "botanical"
    assert "user_id" not in r.json()["event"]


# ---------------- Wish -> RSVP cascade ----------------
@pytest.fixture(scope="module")
def cascade_event(headers, created_ids):
    e = _create(headers, created_ids, "wedding", "anselma-heritage", "TEST Cascade RSVP")
    eid = e["event_id"]
    r = requests.post(f"{API}/events/{eid}/guests", headers=headers,
                      json={"guests": [{"name": "TEST Guest A", "whatsapp": "+62811"},
                                       {"name": "TEST Guest B"},
                                       {"name": "TEST Guest C"}]})
    assert r.status_code == 200, r.text
    guests = r.json()
    requests.post(f"{API}/events/{eid}/publish-free", headers=headers)
    slug = requests.get(f"{API}/events/{eid}", headers=headers).json()["slug"]
    return {"event_id": eid, "slug": slug, "guests": guests}


def test_wish_cascades_to_guest_rsvp(cascade_event, headers, mongo_db):
    g = cascade_event["guests"][0]
    payload = {"name": "TEST Guest A", "message": "TEST cascade message",
               "attending": "attending", "guest_slug": g["slug"], "guest_count": 3}
    r = requests.post(f"{API}/public/inv/{cascade_event['slug']}/wishes", json=payload)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["rsvp_updated"] is True
    assert j["attending"] == "attending"
    assert j["wish_id"].startswith("w_")

    guest = mongo_db.guests.find_one({"guest_id": g["guest_id"]}, {"_id": 0})
    assert guest["rsvp_status"] == "attending"
    assert guest["guest_count"] == 3
    assert guest["notes"] == "TEST cascade message"
    assert guest["responded_at"]

    s = requests.get(f"{API}/events/{cascade_event['event_id']}/rsvp/summary", headers=headers)
    assert s.status_code == 200
    summary = s.json()["summary"]
    assert summary["attending"] == 1
    assert summary["total_headcount"] == 3
    assert summary["pending"] == 2


def test_wish_maybe_does_not_cascade(cascade_event, mongo_db):
    g = cascade_event["guests"][1]
    r = requests.post(f"{API}/public/inv/{cascade_event['slug']}/wishes",
                      json={"name": "TEST Guest B", "message": "TEST maybe",
                            "attending": "maybe", "guest_slug": g["slug"], "guest_count": 2})
    assert r.status_code == 200, r.text
    assert r.json()["rsvp_updated"] is False
    guest = mongo_db.guests.find_one({"guest_id": g["guest_id"]}, {"_id": 0})
    assert guest["rsvp_status"] == "pending"


def test_wish_not_attending_cascades(cascade_event, mongo_db):
    g = cascade_event["guests"][2]
    r = requests.post(f"{API}/public/inv/{cascade_event['slug']}/wishes",
                      json={"name": "TEST Guest C", "message": "TEST sorry",
                            "attending": "not_attending", "guest_slug": g["slug"]})
    assert r.status_code == 200, r.text
    assert r.json()["rsvp_updated"] is True
    guest = mongo_db.guests.find_one({"guest_id": g["guest_id"]}, {"_id": 0})
    assert guest["rsvp_status"] == "not_attending"
    assert guest["guest_count"] == 1


def test_wish_without_guest_slug_no_cascade(cascade_event):
    before = requests.get(f"{API}/public/inv/{cascade_event['slug']}/wishes").json()
    r = requests.post(f"{API}/public/inv/{cascade_event['slug']}/wishes",
                      json={"name": "TEST Anon", "message": "TEST no slug", "attending": "attending"})
    assert r.status_code == 200, r.text
    assert r.json()["rsvp_updated"] is False
    after = requests.get(f"{API}/public/inv/{cascade_event['slug']}/wishes").json()
    assert len(after) == len(before) + 1


def test_wish_unknown_guest_slug_no_cascade(cascade_event):
    r = requests.post(f"{API}/public/inv/{cascade_event['slug']}/wishes",
                      json={"name": "TEST Ghost", "message": "TEST ghost",
                            "attending": "attending", "guest_slug": "no-such-guest-xyz"})
    assert r.status_code == 200, r.text
    assert r.json()["rsvp_updated"] is False


def test_wish_guest_count_clamped(cascade_event, mongo_db):
    g = cascade_event["guests"][0]
    r = requests.post(f"{API}/public/inv/{cascade_event['slug']}/wishes",
                      json={"name": "TEST Guest A", "message": "TEST clamp",
                            "attending": "attending", "guest_slug": g["slug"], "guest_count": 999})
    assert r.status_code == 200, r.text
    guest = mongo_db.guests.find_one({"guest_id": g["guest_id"]}, {"_id": 0})
    assert guest["guest_count"] == 20, guest["guest_count"]


# ---------------- Mock checkout ----------------
def test_mock_checkout_shape(headers, created_ids):
    e = _create(headers, created_ids, "corporate", "gala-black-tie", "TEST Checkout")
    r = requests.post(f"{API}/events/{e['event_id']}/checkout", headers=headers)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["mocked"] is True
    assert j["mode"] == "mocked"
    assert j["amount_idr"] == 149000
    assert j["payment_id"].startswith("pay_")
    assert j["checkout_url"] == f"/checkout/{j['payment_id']}"


def test_checkout_other_user_404(mongo_db, headers, created_ids):
    e = _create(headers, created_ids, "birthday", "kids-joy", "TEST Ownership")
    r = requests.post(f"{API}/events/{e['event_id']}/checkout")
    assert r.status_code == 401


def test_xendit_webhook_rejected_without_token():
    r = requests.post(f"{API}/xendit/webhook", json={"external_id": "x", "status": "PAID"})
    assert r.status_code in (401, 403), r.status_code
