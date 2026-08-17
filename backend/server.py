import os
import logging
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Dict

import httpx
from fastapi import FastAPI, APIRouter, Header, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ----------------------------- Models -----------------------------
class SessionRequest(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None


class SessionResponse(BaseModel):
    session_token: str
    user: UserOut


class ExpenseFieldIn(BaseModel):
    title: str
    amount: float
    description: Optional[str] = ""
    weekday: int


class EntryIn(BaseModel):
    title: str
    limit: float
    spent: float
    weekday: int


class SpoilanceHist(BaseModel):
    month: str
    limit: float
    spent: float


class AdvisorRequest(BaseModel):
    stipend: float
    savings: float
    spoilance_limit: float
    currency: str = "INR"
    templates: List[ExpenseFieldIn] = []
    recent_entries: List[EntryIn] = []
    spoilance_history: List[SpoilanceHist] = []


# ----------------------------- Auth helpers -----------------------------
async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ----------------------------- Routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "Spoilancer API"}


@api_router.post("/auth/session", response_model=SessionResponse)
async def create_session(payload: SessionRequest):
    async with httpx.AsyncClient(timeout=20.0) as hc:
        resp = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")

    data = resp.json()
    email = data.get("email")
    name = data.get("name") or (email.split("@")[0] if email else "User")
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Incomplete session data")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = "user_" + os.urandom(6).hex()
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": datetime.now(timezone.utc),
            }
        )

    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        }
    )

    return SessionResponse(
        session_token=session_token,
        user=UserOut(user_id=user_id, email=email, name=name, picture=picture),
    )


@api_router.get("/auth/me", response_model=UserOut)
async def get_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return UserOut(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name", ""),
        picture=user.get("picture"),
    )


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ----------------------------- AI Advisor -----------------------------
ADVISOR_SYSTEM = (
    "You are Spoilancer's AI money advisor. You analyse a user's committed daily spending limits, "
    "their descriptions/context, their recent actual spends versus those limits, and their spoilance "
    "(splurge) budget vs how much they actually splurged. You give sharp, practical, non-judgemental "
    "advice to help them tune limits and their spoilance allocation. Use a tolerance band of +/- 10% "
    "before recommending a change. If they consistently underspend a limit, recommend lowering it and "
    "moving the difference to savings. If they consistently overspend, recommend a realistic increase. "
    "For spoilance, if they rarely use their full budget, recommend lowering it and boosting savings. "
    "Respond ONLY with strict JSON, no markdown, matching exactly this schema: "
    '{"summary": string, "overall_health": "great"|"good"|"watch"|"risk", '
    '"limit_suggestions": [{"title": string, "current": number, "suggested": number, "reason": string}], '
    '"spoilance_suggestion": {"current": number, "suggested": number, "move_to_savings": number, "reason": string}, '
    '"tips": [string]}'
)


@api_router.post("/advisor/analyze")
async def advisor_analyze(payload: AdvisorRequest, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    context = {
        "currency": payload.currency,
        "monthly_stipend": payload.stipend,
        "current_savings": payload.savings,
        "spoilance_limit": payload.spoilance_limit,
        "daily_limit_templates": [t.model_dump() for t in payload.templates],
        "recent_actual_spends_vs_limit": [e.model_dump() for e in payload.recent_entries],
        "past_spoilance_usage": [s.model_dump() for s in payload.spoilance_history],
    }

    user_text = (
        "Analyse the following personal finance data and return your JSON recommendation. "
        "Amounts are in " + payload.currency + ".\n\n"
        + json.dumps(context, indent=2)
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id="advisor-" + os.urandom(4).hex(),
        system_message=ADVISOR_SYSTEM,
    ).with_model("gemini", "gemini-3-flash-preview")

    try:
        response = await chat.send_message(UserMessage(text=user_text))
    except Exception as e:
        logger.exception("Advisor LLM call failed")
        raise HTTPException(status_code=502, detail=f"AI advisor failed: {e}")

    text = response if isinstance(response, str) else str(response)
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    # Extract first JSON object
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    parsed = None
    if start != -1 and end != -1:
        try:
            parsed = json.loads(cleaned[start : end + 1])
        except Exception:
            parsed = None

    if parsed is None:
        parsed = {
            "summary": text[:500],
            "overall_health": "good",
            "limit_suggestions": [],
            "spoilance_suggestion": None,
            "tips": [],
        }

    return parsed


# ----------------------------- App wiring -----------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"Index creation issue: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
