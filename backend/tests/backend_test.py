"""Backend tests for Undangan Digital."""
import os
import io
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://invite-subur.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def seeded_session(mongo_db):
    uid = f"test-user-{uuid.uuid4().hex[:8]}"
    token = f"test_session_{uuid.uuid4().hex}"
    mongo_db.users.insert_one({
        "user_id": uid,
        "email": f"test.user.{uid}@example.com",
        "name": "Andi Rina",
        "picture": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    yield {"user_id": uid, "token": token}
    # cleanup
    mongo_db.users.delete_one({"user_id": uid})
    mongo_db.user_sessions.delete_one({"session_token": token})


@pytest.fixture
def auth_headers(seeded_session):
    return {"Authorization": f"Bearer {seeded_session['token']}"}


# ---------------- Health & Templates ----------------
def test_root_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True
    assert j["service"] == "undangan-digital"


def test_auth_me_unauthenticated():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_templates_list():
    r = requests.get(f"{API}/templates")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 21
    cats = {t["category"] for t in data}
    assert {"wedding", "aqiqah", "birthday", "corporate"}.issubset(cats)


def test_templates_wedding_filter():
    r = requests.get(f"{API}/templates?category=wedding")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert all(t["category"] == "wedding" for t in data)


# ---------------- Auth via seeded session ----------------
def test_auth_me_with_bearer(auth_headers, seeded_session):
    r = requests.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200, r.text
    u = r.json()
    assert u["user_id"] == seeded_session["user_id"]
    assert u["email"].startswith("test.user.")


# ---------------- Event CRUD ----------------
@pytest.fixture(scope="module")
def created_event_holder():
    return {}


def test_create_event(auth_headers, created_event_holder):
    payload = {"title": "Invite Subur", "event_type": "wedding", "template_id": "elegant-rose"}
    r = requests.post(f"{API}/events", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    e = r.json()
    assert e["event_type"] == "wedding"
    assert e["template_id"] == "elegant-rose"
    assert e["status"] == "draft"
    assert e["tier"] == "free"
    assert "slug" in e and e["slug"]
    assert e["config"]["bride_name"] and e["config"]["groom_name"]
    assert e["config"]["event_date"] and e["config"]["venue"]
    created_event_holder["event"] = e


def test_list_events(auth_headers, created_event_holder):
    r = requests.get(f"{API}/events", headers=auth_headers)
    assert r.status_code == 200
    events = r.json()
    ids = [e["event_id"] for e in events]
    assert created_event_holder["event"]["event_id"] in ids
    for e in events:
        assert "guest_count" in e


def test_get_event(auth_headers, created_event_holder):
    eid = created_event_holder["event"]["event_id"]
    r = requests.get(f"{API}/events/{eid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["event_id"] == eid


def test_patch_event_config(auth_headers, created_event_holder):
    eid = created_event_holder["event"]["event_id"]
    old_updated = created_event_holder["event"]["updated_at"]
    time.sleep(0.05)
    r = requests.patch(f"{API}/events/{eid}", json={"config": {"bride_name": "Test Bride"}}, headers=auth_headers)
    assert r.status_code == 200, r.text
    e = r.json()
    assert e["config"]["bride_name"] == "Test Bride"
    assert e["updated_at"] != old_updated


# ---------------- Guests ----------------
@pytest.fixture(scope="module")
def guests_holder():
    return {}


def test_add_guests_bulk(auth_headers, created_event_holder, guests_holder):
    eid = created_event_holder["event"]["event_id"]
    payload = {"guests": [{"name": "Pak Budi", "whatsapp": "+62811"}, {"name": "Bu Ani"}]}
    r = requests.post(f"{API}/events/{eid}/guests", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    gs = r.json()
    assert len(gs) == 2
    slugs = [g["slug"] for g in gs]
    assert len(set(slugs)) == 2
    guests_holder["guests"] = gs


def test_list_guests(auth_headers, created_event_holder):
    eid = created_event_holder["event"]["event_id"]
    r = requests.get(f"{API}/events/{eid}/guests", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


# ---------------- Payment / Publish ----------------
@pytest.fixture(scope="module")
def payment_holder():
    return {}


def test_checkout(auth_headers, created_event_holder, payment_holder):
    eid = created_event_holder["event"]["event_id"]
    r = requests.post(f"{API}/events/{eid}/checkout", headers=auth_headers)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["amount_idr"] == 149000
    assert j["mocked"] is True
    assert isinstance(j["methods"], list) and len(j["methods"]) > 0
    assert "payment_id" in j
    payment_holder["payment_id"] = j["payment_id"]


def test_wa_send_requires_published(auth_headers, created_event_holder):
    eid = created_event_holder["event"]["event_id"]
    r = requests.post(f"{API}/events/{eid}/whatsapp/send", headers=auth_headers)
    assert r.status_code == 400


def test_complete_payment(auth_headers, created_event_holder, payment_holder):
    pid = payment_holder["payment_id"]
    r = requests.post(f"{API}/payments/{pid}/complete", headers=auth_headers)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["mocked"] is True
    assert j["event"]["status"] == "published"
    assert j["event"]["tier"] == "paid"
    assert j["event"]["published_at"]
    # refresh slug for downstream tests
    created_event_holder["event"] = j["event"]


def test_wa_send_after_publish(auth_headers, created_event_holder):
    eid = created_event_holder["event"]["event_id"]
    r = requests.post(f"{API}/events/{eid}/whatsapp/send", headers=auth_headers)
    assert r.status_code == 200
    j = r.json()
    assert j["mocked"] is True
    assert j["sent_count"] == 2
    # verify persistence
    r2 = requests.get(f"{API}/events/{eid}/guests", headers=auth_headers)
    for g in r2.json():
        assert g["sent_wa"] is True


# ---------------- Public invitation & RSVP ----------------
def test_public_invitation_and_rsvp(auth_headers, created_event_holder, guests_holder):
    slug = created_event_holder["event"]["slug"]
    guest_slug = guests_holder["guests"][0]["slug"]
    r = requests.get(f"{API}/public/inv/{slug}?guest={guest_slug}")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["event"]["slug"] == slug
    assert j["guest"]["slug"] == guest_slug
    assert "user_id" not in j["event"]

    # submit rsvp
    r2 = requests.post(f"{API}/public/inv/{slug}/{guest_slug}/rsvp",
                       json={"rsvp_status": "attending", "guest_count": 2, "notes": "thanks"})
    assert r2.status_code == 200

    # confirm summary
    eid = created_event_holder["event"]["event_id"]
    r3 = requests.get(f"{API}/events/{eid}/rsvp/summary", headers=auth_headers)
    assert r3.status_code == 200
    s = r3.json()["summary"]
    assert s["attending"] == 1
    assert s["pending"] == 1
    assert s["total_headcount"] == 2


def test_public_draft_returns_404(auth_headers):
    # create a fresh draft event
    payload = {"title": "Draft Event", "event_type": "birthday", "template_id": "modern-celebration"}
    r = requests.post(f"{API}/events", json=payload, headers=auth_headers)
    assert r.status_code == 200
    e = r.json()
    r2 = requests.get(f"{API}/public/inv/{e['slug']}")
    assert r2.status_code == 404
    # cleanup
    requests.delete(f"{API}/events/{e['event_id']}", headers=auth_headers)


# ---------------- Publish-free alt ----------------
def test_publish_free(auth_headers):
    payload = {"title": "Free Publish", "event_type": "aqiqah", "template_id": "aqiqah-serene"}
    r = requests.post(f"{API}/events", json=payload, headers=auth_headers)
    e = r.json()
    eid = e["event_id"]
    r2 = requests.post(f"{API}/events/{eid}/publish-free", headers=auth_headers)
    assert r2.status_code == 200
    r3 = requests.get(f"{API}/events/{eid}", headers=auth_headers)
    ev = r3.json()
    assert ev["status"] == "published"
    assert ev["tier"] == "free"
    requests.delete(f"{API}/events/{eid}", headers=auth_headers)


# ---------------- File upload ----------------
def test_file_upload_download(auth_headers):
    # 1x1 PNG
    png = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
        "0000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082"
    )
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    r = requests.post(f"{API}/upload", files=files, headers=auth_headers)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "file_id" in j and "url" in j
    r2 = requests.get(f"{BASE_URL}{j['url']}")
    assert r2.status_code == 200
    assert r2.headers.get("content-type", "").startswith("image/")


# ---------------- Delete cascade ----------------
def test_delete_event_cascade(auth_headers, created_event_holder, mongo_db):
    eid = created_event_holder["event"]["event_id"]
    r = requests.delete(f"{API}/events/{eid}", headers=auth_headers)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/events/{eid}", headers=auth_headers)
    assert r2.status_code == 404
    assert mongo_db.guests.count_documents({"event_id": eid}) == 0
