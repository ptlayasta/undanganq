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
    # === WEDDING ===
    {"template_id": "anselma-heritage", "name": "Anselma Heritage", "category": "wedding", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1543157145-f78c636d023d?w=800&q=85",
     "theme": {"primary": "#8a6a3a", "accent": "#c9a961", "bg": "#f4ecdd", "font_heading": "Cormorant Garamond", "ornament": "floral"}},
    {"template_id": "elegant-rose", "name": "Elegant Rose", "category": "wedding", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1650377509488-724221735c19?w=800&q=85",
     "theme": {"primary": "#C05C46", "accent": "#D4AF37", "bg": "#F9F8F6", "font_heading": "Cormorant Garamond", "ornament": "floral"}},
    {"template_id": "garden-bloom", "name": "Garden Bloom", "category": "wedding", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=85",
     "theme": {"primary": "#4A5D4E", "accent": "#D4AF37", "bg": "#F4F1EA", "font_heading": "Cormorant Garamond", "ornament": "botanical"}},
    {"template_id": "batik-heritage", "name": "Batik Heritage", "category": "wedding", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1650377509454-1bbd8392e122?w=800&q=85",
     "theme": {"primary": "#7A2E1F", "accent": "#D4AF37", "bg": "#1A1410", "font_heading": "Cormorant Garamond", "ornament": "geometric"}},
    {"template_id": "midnight-noir", "name": "Midnight Noir", "category": "wedding", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=85",
     "theme": {"primary": "#111111", "accent": "#c9a961", "bg": "#0d0d0d", "font_heading": "Cormorant Garamond", "ornament": "geometric"}},
    {"template_id": "tropical-paradise", "name": "Tropical Paradise", "category": "wedding", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&q=85",
     "theme": {"primary": "#2E5D4E", "accent": "#e8b96f", "bg": "#eef4ea", "font_heading": "Cormorant Garamond", "ornament": "botanical"}},
    {"template_id": "javanese-royal", "name": "Javanese Royal", "category": "wedding", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=85",
     "theme": {"primary": "#6b2d24", "accent": "#d4af37", "bg": "#f6ecda", "font_heading": "Cormorant Garamond", "ornament": "geometric"}},
    {"template_id": "minimalist-blush", "name": "Minimalist Blush", "category": "wedding", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=85",
     "theme": {"primary": "#8a5a5a", "accent": "#d4a5a5", "bg": "#fef5f2", "font_heading": "Cormorant Garamond", "ornament": "floral"}},

    # === AQIQAH ===
    {"template_id": "aqiqah-serene", "name": "Aqiqah Serene", "category": "aqiqah", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1612538946893-033c6bb7060c?w=800&q=85",
     "theme": {"primary": "#4A5D4E", "accent": "#C9A961", "bg": "#F9F8F6", "font_heading": "Cormorant Garamond", "ornament": "botanical"}},
    {"template_id": "aqiqah-blossom", "name": "Aqiqah Blossom", "category": "aqiqah", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1544033527-b192daee1f5b?w=800&q=85",
     "theme": {"primary": "#5a7a8a", "accent": "#c9a961", "bg": "#eaf1f5", "font_heading": "Cormorant Garamond", "ornament": "floral"}},

    # === KHITANAN (Circumcision) ===
    {"template_id": "khitanan-classic", "name": "Khitanan Classic", "category": "khitanan", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=85",
     "theme": {"primary": "#2E5D6E", "accent": "#d4af37", "bg": "#f0f5f5", "font_heading": "Cormorant Garamond", "ornament": "geometric"}},

    # === TUNANGAN (Engagement) ===
    {"template_id": "engagement-rose", "name": "Engagement Rose", "category": "engagement", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=85",
     "theme": {"primary": "#B04A5D", "accent": "#d4af37", "bg": "#fdf3f4", "font_heading": "Cormorant Garamond", "ornament": "floral"}},

    # === BIRTHDAY ===
    {"template_id": "modern-celebration", "name": "Modern Celebration", "category": "birthday", "tier": "free",
     "cover": "https://images.pexels.com/photos/32346176/pexels-photo-32346176.jpeg?w=800",
     "theme": {"primary": "#C05C46", "accent": "#D4AF37", "bg": "#FFFFFF", "font_heading": "Cabinet Grotesk", "ornament": "geometric"}},
    {"template_id": "kids-joy", "name": "Kids Joy", "category": "birthday", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=85",
     "theme": {"primary": "#e8709b", "accent": "#f5c86e", "bg": "#fff8ee", "font_heading": "Cabinet Grotesk", "ornament": "floral"}},
    {"template_id": "milestone-gold", "name": "Milestone Gold", "category": "birthday", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1533294455009-a77b7557d2d1?w=800&q=85",
     "theme": {"primary": "#1a1a1a", "accent": "#d4af37", "bg": "#f9f6ee", "font_heading": "Cabinet Grotesk", "ornament": "geometric"}},

    # === WISUDA (Graduation) ===
    {"template_id": "graduation-honor", "name": "Graduation Honor", "category": "graduation", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=85",
     "theme": {"primary": "#1a3a5f", "accent": "#d4af37", "bg": "#f5f7fb", "font_heading": "Cormorant Garamond", "ornament": "geometric"}},

    # === ANNIVERSARY ===
    {"template_id": "anniversary-forever", "name": "Anniversary Forever", "category": "anniversary", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=85",
     "theme": {"primary": "#8a4a5d", "accent": "#d4af37", "bg": "#fdf5f5", "font_heading": "Cormorant Garamond", "ornament": "floral"}},

    # === BABY SHOWER ===
    {"template_id": "baby-shower-cloud", "name": "Baby Shower Cloud", "category": "baby_shower", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800&q=85",
     "theme": {"primary": "#7ba7c4", "accent": "#f2c98a", "bg": "#eef5fa", "font_heading": "Cabinet Grotesk", "ornament": "floral"}},

    # === CORPORATE ===
    {"template_id": "corporate-elegant", "name": "Corporate Elegant", "category": "corporate", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1670529776180-60e4132ab90c?w=800&q=85",
     "theme": {"primary": "#1A2A3A", "accent": "#D4AF37", "bg": "#F9F8F6", "font_heading": "Cabinet Grotesk", "ornament": "geometric"}},
    {"template_id": "gala-black-tie", "name": "Gala Black Tie", "category": "corporate", "tier": "paid",
     "cover": "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=85",
     "theme": {"primary": "#0d0d0d", "accent": "#d4af37", "bg": "#111111", "font_heading": "Cabinet Grotesk", "ornament": "geometric"}},

    # === SYUKURAN (Thanksgiving / general gathering) ===
    {"template_id": "syukuran-heartfelt", "name": "Syukuran Heartfelt", "category": "syukuran", "tier": "free",
     "cover": "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=85",
     "theme": {"primary": "#5a7a4a", "accent": "#d4af37", "bg": "#f5f7ef", "font_heading": "Cormorant Garamond", "ornament": "botanical"}},
]


EVENT_TYPES = [
    {"key": "wedding", "label": "Pernikahan"},
    {"key": "engagement", "label": "Tunangan"},
    {"key": "aqiqah", "label": "Aqiqah"},
    {"key": "khitanan", "label": "Khitanan"},
    {"key": "birthday", "label": "Ulang Tahun"},
    {"key": "graduation", "label": "Wisuda"},
    {"key": "anniversary", "label": "Anniversary"},
    {"key": "baby_shower", "label": "Baby Shower"},
    {"key": "syukuran", "label": "Syukuran"},
    {"key": "corporate", "label": "Korporat"},
]


@api_router.get("/templates")
async def list_templates(category: Optional[str] = None):
    if category:
        return [t for t in TEMPLATES if t["category"] == category]
    return TEMPLATES


@api_router.get("/event-types")
async def list_event_types():
    return EVENT_TYPES


# ------------------------------ Events ---------------------------------------
DEFAULT_SECTIONS = {
    "show_cover": True,
    "show_verse": True,
    "show_couple": True,
    "show_love_story": True,
    "show_gallery": True,
    "show_video": True,
    "show_countdown": True,
    "show_events": True,
    "show_gift": True,
    "show_rsvp": True,
    "show_wishes": True,
}


def default_config(event_type: str) -> dict:
    base = {
        "hashtag": "",
        "story": "Dengan penuh syukur, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dalam acara kami.",
        "gallery": [],
        "music_url": "",
        "video_url": "",
        "events": [
            {"name": "Acara", "date": "2026-06-15", "time_start": "10:00", "time_end": "12:00", "venue": "Venue", "address": "Alamat lengkap", "maps_url": ""},
        ],
        "banks": [],
        "ornament_set": "floral",
        **DEFAULT_SECTIONS,
    }
    if event_type == "wedding":
        return {
            **base,
            "bride_name": "Agnes", "groom_name": "Abraham",
            "hashtag": "#ABeginningOfLove",
            "verse_text": "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.",
            "verse_ref": "Jeremiah 29:11",
            "bride_full_name": "Agnes Arimbi Ayuwanti", "groom_full_name": "Paskah Abraham Alvyanto",
            "bride_parents": "Mr. Prof. Dr. Jati Batoro & Mrs. Sri Suwanti",
            "groom_parents": "Mr. Antonius Yuwono & Mrs. Evy Christina",
            "bride_instagram": "", "groom_instagram": "",
            "bride_photo": "", "groom_photo": "",
            "event_date": "2026-06-15", "event_time": "10:00",
            "venue": "Malang, Indonesia", "venue_address": "",
            "story": "Dengan penuh syukur atas berkat Tuhan, kami mengundang Bapak/Ibu/Saudara/i untuk hadir dalam acara pernikahan kami.",
            "love_story": [
                {"title": "First Meet", "date": "2021", "description": "It all began through a simple hello — two hearts met in the most ordinary way.", "photo": ""},
                {"title": "The Journey", "date": "2022 - 2024", "description": "Through the years, we learned love is about patience, forgiveness, and choosing each other again.", "photo": ""},
                {"title": "Forever Begins", "date": "2026", "description": "Now, after beautiful years, we step into a new beginning — guided by grace.", "photo": ""},
            ],
            "events": [
                {"name": "Akad Nikah", "date": "2026-06-15", "time_start": "10:00", "time_end": "12:00", "venue": "Grand Ballroom", "address": "Jl. Contoh No. 1, Malang", "maps_url": ""},
                {"name": "Resepsi", "date": "2026-06-15", "time_start": "19:00", "time_end": "21:00", "venue": "Grand Ballroom", "address": "Jl. Contoh No. 1, Malang", "maps_url": ""},
            ],
            "banks": [{"bank": "BCA", "account_number": "1234567890", "account_name": "Agnes Arimbi"}],
        }
    if event_type == "engagement":
        return {
            **base,
            "bride_name": "Rina", "groom_name": "Andi",
            "hashtag": "#RinaAndi",
            "story": "Dengan penuh syukur, kami mengundang untuk acara pertunangan kami.",
            "show_love_story": False, "show_gift": False,
            "events": [{"name": "Tunangan", "date": "2026-06-15", "time_start": "10:00", "time_end": "12:00", "venue": "Kediaman", "address": "", "maps_url": ""}],
        }
    if event_type == "aqiqah":
        return {
            **base,
            "baby_name": "Muhammad Adam", "parents": "Ahmad & Siti", "gender": "male",
            "event_date": "2026-04-10", "event_time": "09:00",
            "venue": "Jakarta", "venue_address": "Jl. Kenanga No. 5, Jakarta",
            "story": "Dengan penuh syukur, kami mengundang untuk aqiqah putra kami.",
            "show_couple": False, "show_love_story": False, "show_video": False,
            "events": [{"name": "Aqiqah", "date": "2026-04-10", "time_start": "09:00", "time_end": "11:00", "venue": "Kediaman", "address": "", "maps_url": ""}],
        }
    if event_type == "khitanan":
        return {
            **base,
            "child_name": "Muhammad Farhan", "parents": "Ahmad & Siti",
            "story": "Kami mengundang untuk hadir dalam acara khitanan putra kami.",
            "show_couple": False, "show_love_story": False, "show_video": False,
            "events": [{"name": "Khitanan", "date": "2026-04-10", "time_start": "10:00", "time_end": "13:00", "venue": "Kediaman", "address": "", "maps_url": ""}],
        }
    if event_type == "birthday":
        return {
            **base,
            "celebrant": "Nabila", "age": "1",
            "host": "Papa & Mama",
            "story": "Yuk rayakan bersama!",
            "show_couple": False, "show_love_story": False, "show_verse": False,
            "events": [{"name": "Perayaan", "date": "2026-05-20", "time_start": "18:00", "time_end": "21:00", "venue": "Rumah", "address": "", "maps_url": ""}],
        }
    if event_type == "graduation":
        return {
            **base,
            "graduate_name": "Andi Pratama, S.Kom",
            "degree": "Sarjana Komputer",
            "university": "Universitas Indonesia",
            "story": "Kami mengundang untuk merayakan momen kelulusan.",
            "show_couple": False, "show_love_story": False, "show_gift": False, "show_video": False,
            "events": [{"name": "Syukuran Wisuda", "date": "2026-07-01", "time_start": "18:00", "time_end": "21:00", "venue": "Restoran", "address": "", "maps_url": ""}],
        }
    if event_type == "anniversary":
        return {
            **base,
            "bride_name": "Rina", "groom_name": "Andi",
            "years": "10",
            "story": "Bersyukur atas perjalanan bersama, kami mengundang Anda merayakan hari jadi kami.",
            "events": [{"name": "Anniversary Dinner", "date": "2026-06-15", "time_start": "19:00", "time_end": "22:00", "venue": "Fine Dining", "address": "", "maps_url": ""}],
        }
    if event_type == "baby_shower":
        return {
            **base,
            "mother_name": "Rina", "father_name": "Andi", "baby_gender": "unknown",
            "due_date": "2026-08-01",
            "story": "Sharing our joyful news — please celebrate with us.",
            "show_couple": False, "show_love_story": False, "show_gift": False,
            "events": [{"name": "Baby Shower", "date": "2026-06-15", "time_start": "14:00", "time_end": "17:00", "venue": "Kediaman", "address": "", "maps_url": ""}],
        }
    if event_type == "syukuran":
        return {
            **base,
            "host_name": "Keluarga Ahmad",
            "occasion": "Syukuran Rumah Baru",
            "story": "Dengan penuh syukur atas berkat Allah SWT, kami mengundang untuk syukuran.",
            "show_couple": False, "show_love_story": False, "show_gift": False, "show_video": False,
        }
    if event_type == "corporate":
        return {
            **base,
            "company_name": "PT Contoh Indonesia",
            "event_name": "Annual Gala Dinner 2026",
            "story": "We cordially invite you to join our annual gala dinner.",
            "show_couple": False, "show_love_story": False, "show_verse": False, "show_gift": False,
            "events": [{"name": "Gala Dinner", "date": "2026-11-15", "time_start": "18:00", "time_end": "22:00", "venue": "Hotel Ballroom", "address": "", "maps_url": ""}],
        }
    # fallback
    return base


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
    guest_slug: Optional[str] = None  # if set, also cascades to guest RSVP
    guest_count: Optional[int] = 1


@api_router.post("/public/inv/{slug}/wishes")
async def submit_wish(slug: str, payload: WishSubmit):
    event = await db.events.find_one({"slug": slug}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    name = (payload.name or "").strip()[:80]
    message = (payload.message or "").strip()[:600]
    if not name or not message:
        raise HTTPException(status_code=400, detail="name and message required")
    attending = payload.attending if payload.attending in ("attending", "not_attending", "maybe") else None
    doc = {
        "wish_id": f"w_{uuid.uuid4().hex[:10]}",
        "event_id": event["event_id"],
        "name": name,
        "message": message,
        "attending": attending,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wishes.insert_one(doc)
    doc.pop("_id", None)

    # Cascade RSVP for named guest if provided and attending is decisive
    rsvp_updated = False
    if payload.guest_slug and attending in ("attending", "not_attending"):
        gc = max(1, min(int(payload.guest_count or 1), 20))
        r = await db.guests.update_one(
            {"event_id": event["event_id"], "slug": payload.guest_slug},
            {"$set": {
                "rsvp_status": attending,
                "guest_count": gc,
                "notes": message,
                "responded_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        rsvp_updated = r.modified_count > 0
    return {**doc, "rsvp_updated": rsvp_updated}


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


# ------------------------------ Payment (Xendit) ----------------------------
XENDIT_SECRET_KEY = os.environ.get("XENDIT_SECRET_KEY", "").strip()
XENDIT_CALLBACK_TOKEN = os.environ.get("XENDIT_CALLBACK_TOKEN", "").strip()
XENDIT_BASE_URL = "https://api.xendit.co"


@api_router.get("/payment/config")
async def payment_config():
    return {"provider": "xendit", "mode": "live" if XENDIT_SECRET_KEY else "mocked"}


@api_router.post("/events/{event_id}/checkout")
async def checkout_event(event_id: str,
                          session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Xendit checkout. Real Xendit Invoice when XENDIT_SECRET_KEY is set; MOCK otherwise."""
    user = await get_current_user(session_token=session_token, authorization=authorization)
    event = await db.events.find_one({"event_id": event_id, "user_id": user["user_id"]}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    amount_idr = 149000

    if XENDIT_SECRET_KEY:
        # Real Xendit Invoice API
        try:
            r = requests.post(
                f"{XENDIT_BASE_URL}/v2/invoices",
                auth=(XENDIT_SECRET_KEY, ""),
                json={
                    "external_id": payment_id,
                    "amount": amount_idr,
                    "payer_email": user["email"],
                    "description": f"Premium invitation for {event['title']}",
                    "success_redirect_url": f"{os.environ.get('APP_ORIGIN', '')}/dashboard",
                    "failure_redirect_url": f"{os.environ.get('APP_ORIGIN', '')}/events/{event_id}/publish",
                    "payment_methods": ["QRIS", "GOPAY", "OVO", "DANA", "BCA", "BNI", "BRI", "MANDIRI"],
                },
                timeout=15,
            )
            r.raise_for_status()
            invoice = r.json()
        except Exception as e:
            logger.error(f"Xendit checkout failed: {e}")
            raise HTTPException(status_code=502, detail="Payment provider error")

        await db.payments.insert_one({
            "payment_id": payment_id, "event_id": event_id, "user_id": user["user_id"],
            "amount_idr": amount_idr, "status": "pending", "provider": "xendit",
            "xendit_invoice_id": invoice["id"], "invoice_url": invoice["invoice_url"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {
            "payment_id": payment_id, "amount_idr": amount_idr,
            "checkout_url": invoice["invoice_url"], "mode": "live",
            "methods": ["QRIS", "BCA VA", "GoPay", "OVO", "DANA"],
        }

    # MOCK path
    await db.payments.insert_one({
        "payment_id": payment_id, "event_id": event_id, "user_id": user["user_id"],
        "amount_idr": amount_idr, "status": "pending", "provider": "xendit_mock",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "payment_id": payment_id, "amount_idr": amount_idr,
        "checkout_url": f"/checkout/{payment_id}", "mode": "mocked", "mocked": True,
        "methods": ["QRIS", "BCA VA", "GoPay", "OVO", "DANA"],
    }


@api_router.post("/xendit/webhook")
async def xendit_webhook(request: Request, x_callback_token: Optional[str] = Header(None, alias="x-callback-token")):
    """Xendit invoice webhook. Only active when XENDIT_CALLBACK_TOKEN is configured."""
    if not XENDIT_CALLBACK_TOKEN or x_callback_token != XENDIT_CALLBACK_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid webhook token")
    payload = await request.json()
    external_id = payload.get("external_id")
    status = payload.get("status")
    if not external_id:
        return {"ok": True}
    if status == "PAID":
        pay = await db.payments.find_one({"payment_id": external_id}, {"_id": 0})
        if pay and pay.get("status") != "paid":
            await db.payments.update_one({"payment_id": external_id}, {"$set": {"status": "paid"}})
            await db.events.update_one(
                {"event_id": pay["event_id"]},
                {"$set": {
                    "status": "published", "tier": "paid",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
    elif status in ("EXPIRED", "FAILED"):
        await db.payments.update_one({"payment_id": external_id, "status": "pending"}, {"$set": {"status": status.lower()}})
    return {"ok": True}


@api_router.post("/payments/{payment_id}/complete")
async def complete_payment(payment_id: str,
                           session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """MOCK ONLY: user confirms payment done - marks event as paid and publishes.
    In live mode Xendit webhook drives status; this endpoint is disabled to prevent bypass."""
    user = await get_current_user(session_token=session_token, authorization=authorization)
    pay = await db.payments.find_one({"payment_id": payment_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Payment not found")
    if pay.get("provider") == "xendit" and XENDIT_SECRET_KEY:
        # In live mode, verify with Xendit before marking paid
        try:
            r = requests.get(f"{XENDIT_BASE_URL}/v2/invoices/{pay['xendit_invoice_id']}",
                             auth=(XENDIT_SECRET_KEY, ""), timeout=15)
            r.raise_for_status()
            inv = r.json()
            if inv.get("status") != "PAID":
                return {"ok": False, "status": inv.get("status", "pending")}
        except Exception:
            raise HTTPException(status_code=502, detail="Payment verification failed")
    await db.payments.update_one({"payment_id": payment_id}, {"$set": {"status": "paid"}})
    await db.events.update_one(
        {"event_id": pay["event_id"]},
        {"$set": {
            "status": "published", "tier": "paid",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    event = await db.events.find_one({"event_id": pay["event_id"]}, {"_id": 0})
    return {"ok": True, "event": event, "mode": "live" if XENDIT_SECRET_KEY else "mocked", "mocked": not XENDIT_SECRET_KEY}


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
