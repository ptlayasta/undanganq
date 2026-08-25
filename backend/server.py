"""Undangan Digital - Digital Invitation SaaS Platform Backend."""
import os
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import requests
from fastapi import FastAPI, APIRouter, HTTPException, Header, Cookie, Response, UploadFile, File, Query, Request
from fastapi.responses import Response as FastAPIResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

APP_NAME = "undangan-digital"
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Undangan Digital API")
api_router = APIRouter(prefix="/api")

# ------------------------------ Storage helpers ------------------------------
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ------------------------------ Models ---------------------------------------
class User(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    created_at: datetime


class Guest(BaseModel):
    guest_id: str = Field(default_factory=lambda: f"g_{uuid.uuid4().hex[:10]}")
    name: str
    whatsapp: Optional[str] = ""
    slug: str
    rsvp_status: str = "pending"  # pending | attending | not_attending
    guest_count: int = 1
    notes: str = ""
    responded_at: Optional[str] = None
    sent_wa: bool = False


class Event(BaseModel):
    event_id: str
    user_id: str
    slug: str
    event_type: str  # wedding | aqiqah | birthday | corporate
    template_id: str
    status: str = "draft"  # draft | paid | published
    tier: str = "free"  # free | paid
    title: str
    config: dict  # customization data
    created_at: str
    updated_at: str
    published_at: Optional[str] = None


class EventCreate(BaseModel):
    title: str
    event_type: str
    template_id: str
    config: dict = {}


class EventUpdate(BaseModel):
    title: Optional[str] = None
    template_id: Optional[str] = None
    config: Optional[dict] = None


class GuestCreate(BaseModel):
    name: str
    whatsapp: Optional[str] = ""


class GuestBulk(BaseModel):
    guests: List[GuestCreate]


class RsvpSubmit(BaseModel):
    rsvp_status: str  # attending | not_attending
    guest_count: int = 1
    notes: str = ""


# ------------------------------ Auth helpers ---------------------------------
def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    s = re.sub(r"[-\s]+", "-", s)
    return s or f"e-{uuid.uuid4().hex[:6]}"


async def get_current_user(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ------------------------------ Auth routes ----------------------------------
@api_router.post("/auth/session")
async def create_session(payload: dict, response: Response):
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id},
        timeout=15,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Auth failed")
    data = r.json()

    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing["name"]), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": data["email"],
                "name": data.get("name", ""),
                "picture": data.get("picture", ""),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    token = data["session_token"]
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": token,
            "expires_at": expires,
            "created_at": datetime.now(timezone.utc),
        }
    )
    response.set_cookie(
        key="session_token", value=token, max_age=7 * 24 * 3600,
        httponly=True, secure=True, samesite="none", path="/",
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": token}


@api_router.get("/auth/me")
async def auth_me(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    return user


@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# ------------------------------ Templates ------------------------------------
TEMPLATES = [
    {
        "template_id": "anselma-heritage",
        "name": "Anselma Heritage",
        "category": "wedding",
        "tier": "paid",
        "cover": "https://images.unsplash.com/photo-1543157145-f78c636d023d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxib3RhbmljYWwlMjBmbG9yYWwlMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4NzY0MzI4OHww&ixlib=rb-4.1.0&q=85",
        "theme": {"primary": "#8a6a3a", "accent": "#c9a961", "bg": "#f4ecdd", "font_heading": "Cormorant Garamond"},
    },
    {
        "template_id": "elegant-rose",
        "name": "Elegant Rose",
        "category": "wedding",
        "tier": "free",
        "cover": "https://images.unsplash.com/photo-1650377509488-724221735c19?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwzfHxpbmRvbmVzaWFuJTIwd2VkZGluZyUyMGNvdXBsZXxlbnwwfHx8fDE3ODc2NDMyODN8MA&ixlib=rb-4.1.0&q=85",
        "theme": {"primary": "#C05C46", "accent": "#D4AF37", "bg": "#F9F8F6", "font_heading": "Cormorant Garamond"},
    },
    {
        "template_id": "garden-bloom",
        "name": "Garden Bloom",
        "category": "wedding",
        "tier": "free",
        "cover": "https://images.unsplash.com/photo-1543157145-f78c636d023d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxib3RhbmljYWwlMjBmbG9yYWwlMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4NzY0MzI4OHww&ixlib=rb-4.1.0&q=85",
        "theme": {"primary": "#4A5D4E", "accent": "#D4AF37", "bg": "#F4F1EA", "font_heading": "Cormorant Garamond"},
    },
    {
        "template_id": "batik-heritage",
        "name": "Batik Heritage",
        "category": "wedding",
        "tier": "paid",
        "cover": "https://images.unsplash.com/photo-1650377509454-1bbd8392e122?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwxfHxpbmRvbmVzaWFuJTIwd2VkZGluZyUyMGNvdXBsZXxlbnwwfHx8fDE3ODc2NDMyODN8MA&ixlib=rb-4.1.0&q=85",
        "theme": {"primary": "#7A2E1F", "accent": "#D4AF37", "bg": "#1A1410", "font_heading": "Cormorant Garamond"},
    },
    {
        "template_id": "aqiqah-serene",
        "name": "Aqiqah Serene",
        "category": "aqiqah",
        "tier": "free",
        "cover": "https://images.unsplash.com/photo-1612538946893-033c6bb7060c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwzfHxib3RhbmljYWwlMjBmbG9yYWwlMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4NzY0MzI4OHww&ixlib=rb-4.1.0&q=85",
        "theme": {"primary": "#4A5D4E", "accent": "#C9A961", "bg": "#F9F8F6", "font_heading": "Cormorant Garamond"},
    },
    {
        "template_id": "modern-celebration",
        "name": "Modern Celebration",
        "category": "birthday",
        "tier": "free",
        "cover": "https://images.pexels.com/photos/32346176/pexels-photo-32346176.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "theme": {"primary": "#C05C46", "accent": "#D4AF37", "bg": "#FFFFFF", "font_heading": "Cabinet Grotesk"},
    },
    {
        "template_id": "corporate-elegant",
        "name": "Corporate Elegant",
        "category": "corporate",
        "tier": "paid",
        "cover": "https://images.unsplash.com/photo-1670529776180-60e4132ab90c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxiZWF1dGlmdWwlMjB3ZWRkaW5nJTIwdmVudWV8ZW58MHx8fHwxNzg3NjQzMjk0fDA&ixlib=rb-4.1.0&q=85",
        "theme": {"primary": "#1A2A3A", "accent": "#D4AF37", "bg": "#F9F8F6", "font_heading": "Cabinet Grotesk"},
    },
]


@api_router.get("/templates")
async def list_templates(category: Optional[str] = None):
    if category:
        return [t for t in TEMPLATES if t["category"] == category]
    return TEMPLATES


# ------------------------------ Events ---------------------------------------
def default_config(event_type: str) -> dict:
    if event_type == "wedding":
        return {
            "bride_name": "Agnes",
            "groom_name": "Abraham",
            "hashtag": "#ABeginningOfLove",
            "verse_text": "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.",
            "verse_ref": "Jeremiah 29:11",
            "bride_full_name": "Agnes Arimbi Ayuwanti",
            "groom_full_name": "Paskah Abraham Alvyanto",
            "bride_parents": "Mr. Prof. Dr. Jati Batoro & Mrs. Sri Suwanti",
            "groom_parents": "Mr. Antonius Yuwono & Mrs. Evy Christina",
            "bride_instagram": "",
            "groom_instagram": "",
            "bride_photo": "",
            "groom_photo": "",
            "event_date": "2026-06-15",
            "event_time": "10:00",
            "venue": "Malang, Indonesia",
            "venue_address": "",
            "story": "Dengan penuh syukur atas berkat Tuhan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dalam acara pernikahan kami.",
            "love_story": [
                {"title": "First Meet", "date": "2021", "description": "It all began through a simple hello — two hearts met in the most ordinary way.", "photo": ""},
                {"title": "The Journey", "date": "2022 - 2024", "description": "Through the years, we learned love is about patience, forgiveness, and choosing each other again.", "photo": ""},
                {"title": "Forever Begins", "date": "2026", "description": "Now, after beautiful years, we step into a new beginning — guided by grace.", "photo": ""},
            ],
            "gallery": [],
            "music_url": "",
            "video_url": "",
            "events": [
                {"name": "Akad Nikah", "date": "2026-06-15", "time_start": "10:00", "time_end": "12:00", "venue": "Grand Ballroom", "address": "Jl. Contoh No. 1, Malang", "maps_url": ""},
                {"name": "Resepsi", "date": "2026-06-15", "time_start": "19:00", "time_end": "21:00", "venue": "Grand Ballroom", "address": "Jl. Contoh No. 1, Malang", "maps_url": ""},
            ],
            "banks": [
                {"bank": "BCA", "account_number": "1234567890", "account_name": "Agnes Arimbi"},
            ],
            "show_gift": True,
            "show_wishes": True,
        }
    if event_type == "aqiqah":
        return {
            "baby_name": "Muhammad Adam",
            "parents": "Ahmad & Siti",
            "event_date": "2026-04-10",
            "event_time": "09:00",
            "venue": "Jakarta",
            "venue_address": "Jl. Kenanga No. 5, Jakarta",
            "story": "Dengan penuh syukur, kami mengundang untuk aqiqah putra kami.",
            "gallery": [],
        }
    return {
        "title": "Ulang Tahun ke-1",
        "celebrant": "Nabila",
        "event_date": "2026-05-20",
        "event_time": "18:00",
        "venue": "Surabaya",
        "venue_address": "",
        "story": "Yuk rayakan bersama!",
        "gallery": [],
    }


@api_router.post("/events")
async def create_event(payload: EventCreate,
                        session_token: Optional[str] = Cookie(None),
                        authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    base_slug = slugify(payload.title)
    slug = f"{base_slug}-{uuid.uuid4().hex[:4]}"
    now = datetime.now(timezone.utc).isoformat()
    cfg = {**default_config(payload.event_type), **(payload.config or {})}
    doc = {
        "event_id": event_id,
        "user_id": user["user_id"],
        "slug": slug,
        "event_type": payload.event_type,
        "template_id": payload.template_id,
        "status": "draft",
        "tier": "free",
        "title": payload.title,
        "config": cfg,
        "created_at": now,
        "updated_at": now,
        "published_at": None,
    }
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/events")
async def list_events(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    events = await db.events.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for e in events:
        cnt = await db.guests.count_documents({"event_id": e["event_id"]})
        e["guest_count"] = cnt
    return events


@api_router.get("/events/{event_id}")
async def get_event(event_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@api_router.patch("/events/{event_id}")
async def update_event(event_id: str, payload: EventUpdate,
                        session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await db.events.update_one({"event_id": event_id, "user_id": user["user_id"]}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    return event


@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    r = await db.events.delete_one({"event_id": event_id, "user_id": user["user_id"]})
    await db.guests.delete_many({"event_id": event_id})
    await db.wishes.delete_many({"event_id": event_id})
    await db.payments.delete_many({"event_id": event_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}


# ------------------------------ Guests ---------------------------------------
@api_router.get("/events/{event_id}/guests")
async def list_guests(event_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    guests = await db.guests.find({"event_id": event_id}, {"_id": 0}).to_list(2000)
    return guests


@api_router.post("/events/{event_id}/guests")
async def add_guests(event_id: str, payload: GuestBulk,
                      session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    created = []
    for g in payload.guests:
        guest_id = f"g_{uuid.uuid4().hex[:10]}"
        slug = slugify(g.name) or guest_id
        # Ensure unique per event
        while await db.guests.find_one({"event_id": event_id, "slug": slug}, {"_id": 0}):
            slug = f"{slugify(g.name)}-{uuid.uuid4().hex[:3]}"
        doc = {
            "guest_id": guest_id,
            "event_id": event_id,
            "name": g.name,
            "whatsapp": g.whatsapp or "",
            "slug": slug,
            "rsvp_status": "pending",
            "guest_count": 1,
            "notes": "",
            "responded_at": None,
            "sent_wa": False,
        }
        await db.guests.insert_one(doc)
        doc.pop("_id", None)
        created.append(doc)
    return created


@api_router.delete("/events/{event_id}/guests/{guest_id}")
async def delete_guest(event_id: str, guest_id: str,
                        session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.guests.delete_one({"event_id": event_id, "guest_id": guest_id})
    return {"ok": True}


@api_router.post("/events/{event_id}/whatsapp/send")
async def send_whatsapp_bulk(event_id: str,
                              session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """MOCKED: Simulates WhatsApp bulk send via Twilio."""
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["status"] != "published":
        raise HTTPException(status_code=400, detail="Event must be published first")
    r = await db.guests.update_many({"event_id": event_id}, {"$set": {"sent_wa": True}})
    return {"ok": True, "sent_count": r.modified_count, "mocked": True}


# ------------------------------ RSVP (public) --------------------------------
@api_router.get("/public/inv/{slug}")
async def public_invitation(slug: str, guest: Optional[str] = None):
    event = await db.events.find_one({"slug": slug}, {"_id": 0})
    if not event or event["status"] != "published":
        raise HTTPException(status_code=404, detail="Invitation not found")
    guest_doc = None
    if guest:
        guest_doc = await db.guests.find_one({"event_id": event["event_id"], "slug": guest}, {"_id": 0})
    # Strip user_id from response
    event.pop("user_id", None)
    return {"event": event, "guest": guest_doc}


@api_router.post("/public/inv/{slug}/{guest_slug}/rsvp")
async def submit_rsvp(slug: str, guest_slug: str, payload: RsvpSubmit):
    event = await db.events.find_one({"slug": slug}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    guest = await db.guests.find_one({"event_id": event["event_id"], "slug": guest_slug}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    if payload.rsvp_status not in ("attending", "not_attending"):
        raise HTTPException(status_code=400, detail="Invalid rsvp_status")
    await db.guests.update_one(
        {"guest_id": guest["guest_id"]},
        {"$set": {
            "rsvp_status": payload.rsvp_status,
            "guest_count": payload.guest_count,
            "notes": payload.notes,
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True}


@api_router.get("/events/{event_id}/rsvp/summary")
async def rsvp_summary(event_id: str,
                       session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    guests = await db.guests.find({"event_id": event_id}, {"_id": 0}).to_list(5000)
    counts = {"attending": 0, "not_attending": 0, "pending": 0, "total_headcount": 0}
    for g in guests:
        counts[g["rsvp_status"]] = counts.get(g["rsvp_status"], 0) + 1
        if g["rsvp_status"] == "attending":
            counts["total_headcount"] += g.get("guest_count", 1)
    return {"summary": counts, "guests": guests}


# ------------------------------ Wishes / Guestbook ---------------------------
class WishSubmit(BaseModel):
    name: str
    message: str
    attending: Optional[str] = None  # attending | not_attending | maybe


@api_router.post("/public/inv/{slug}/wishes")
async def submit_wish(slug: str, payload: WishSubmit):
    event = await db.events.find_one({"slug": slug}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    name = (payload.name or "").strip()[:80]
    message = (payload.message or "").strip()[:600]
    if not name or not message:
        raise HTTPException(status_code=400, detail="name and message required")
    doc = {
        "wish_id": f"w_{uuid.uuid4().hex[:10]}",
        "event_id": event["event_id"],
        "name": name,
        "message": message,
        "attending": payload.attending if payload.attending in ("attending", "not_attending", "maybe") else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wishes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/public/inv/{slug}/wishes")
async def list_wishes(slug: str, limit: int = 100):
    event = await db.events.find_one({"slug": slug}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    wishes = await db.wishes.find({"event_id": event["event_id"]}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 500))
    return wishes


@api_router.get("/events/{event_id}/wishes")
async def list_wishes_owner(event_id: str,
                             session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    wishes = await db.wishes.find({"event_id": event_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return wishes


# ------------------------------ Payment (Xendit MOCK) ------------------------
@api_router.post("/events/{event_id}/checkout")
async def checkout_event(event_id: str,
                          session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """MOCKED Xendit checkout - creates a payment intent."""
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    await db.payments.insert_one({
        "payment_id": payment_id,
        "event_id": event_id,
        "user_id": user["user_id"],
        "amount_idr": 149000,
        "status": "pending",
        "provider": "xendit_mock",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "payment_id": payment_id,
        "amount_idr": 149000,
        "checkout_url": f"/checkout/{payment_id}",
        "methods": ["QRIS", "BCA VA", "GoPay", "OVO", "DANA"],
        "mocked": True,
    }


@api_router.post("/payments/{payment_id}/complete")
async def complete_payment(payment_id: str,
                           session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """MOCK: user confirms payment done - marks event as paid and publishes."""
    user = await get_current_user(session_token=session_token, authorization=authorization)
    pay = await db.payments.find_one({"payment_id": payment_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment not found")
    await db.payments.update_one({"payment_id": payment_id}, {"$set": {"status": "paid"}})
    await db.events.update_one(
        {"event_id": pay["event_id"]},
        {"$set": {
            "status": "published",
            "tier": "paid",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    event = await db.events.find_one({"event_id": pay["event_id"]}, {"_id": 0})
    return {"ok": True, "event": event, "mocked": True}


@api_router.post("/events/{event_id}/publish-free")
async def publish_free(event_id: str,
                        session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Free tier publish - no WA delivery."""
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {
            "status": "published",
            "tier": "free",
            "published_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True}


# ------------------------------ Uploads --------------------------------------
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...),
                       session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    file_id = uuid.uuid4().hex
    path = f"{APP_NAME}/uploads/{user['user_id']}/{file_id}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    doc = {
        "file_id": file_id,
        "user_id": user["user_id"],
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(doc)
    return {"file_id": file_id, "url": f"/api/files/{file_id}", "storage_path": result["path"]}


@api_router.get("/files/{file_id}")
async def download_file(file_id: str):
    record = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(record["storage_path"])
    return FastAPIResponse(content=data, media_type=record.get("content_type") or content_type)


# ------------------------------ Health ---------------------------------------
@api_router.get("/")
async def root():
    return {"ok": True, "service": "undangan-digital"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
