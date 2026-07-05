from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("clientpulse")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 30  # 30 days for single-owner app

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

app = FastAPI(title="ClientPulse API")
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Models ----------
STAGES_DEFAULT = ["Lead", "Pitched", "Negotiating", "Signed", "In Progress", "Delivered", "Past"]
OPEN_STAGES = {"Lead", "Pitched", "Negotiating", "Signed", "In Progress"}
CLOSED_STAGES = {"Delivered", "Past"}


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str


class ForgotPasswordIn(BaseModel):
    email: str


class ResetPasswordIn(BaseModel):
    token: str
    password: str


class ClientIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    phone: str = ""
    preferred_language: Literal["en", "hi"] = "en"
    source: str = "Other"
    stage: str = "Lead"
    quoted_value: float = 0.0
    notes: str = ""


class InteractionIn(BaseModel):
    type: str = "note"  # note, message_sent, follow_up, milestone, pitch, custom
    description: str
    meta: dict = Field(default_factory=dict)


class StageChangeIn(BaseModel):
    stage: str


class TaskIn(BaseModel):
    title: str
    due_date: Optional[str] = None  # ISO date string


class PaymentIn(BaseModel):
    amount: float
    method: Literal["Cash", "UPI", "Bank Transfer"] = "UPI"
    note: str = ""
    received_at: Optional[str] = None  # ISO


class TemplateIn(BaseModel):
    name: str
    category: str  # follow_up, proposal_sent, signed_confirmation, milestone_update, payment_reminder, payment_received, reengagement
    language: Literal["en", "hi"]
    body: str


class SettingsIn(BaseModel):
    stages: Optional[List[str]] = None
    follow_up_lead_days: Optional[int] = None
    quiet_active_days: Optional[int] = None
    owner_name: Optional[str] = None
    business_name: Optional[str] = None


# ---------- Helpers ----------
def clean_doc(d: dict) -> dict:
    if not d:
        return d
    d.pop("_id", None)
    return d


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    if not s:
        s = {
            "id": "singleton",
            "stages": STAGES_DEFAULT,
            "follow_up_lead_days": 3,
            "quiet_active_days": 7,
            "owner_name": os.environ.get("OWNER_NAME", "Raj"),
            "business_name": "ClientPulse",
        }
        await db.settings.insert_one(s)
        s.pop("_id", None)
    return s


async def add_interaction(client_id: str, type_: str, description: str, meta: Optional[dict] = None) -> dict:
    doc = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "type": type_,
        "description": description,
        "meta": meta or {},
        "created_at": iso(now_utc()),
    }
    await db.interactions.insert_one(doc.copy())
    await db.clients.update_one({"id": client_id}, {"$set": {"last_contact_at": doc["created_at"]}})
    return clean_doc(doc)


async def client_money(client_id: str, quoted: float) -> dict:
    total_paid = 0.0
    async for p in db.payments.find({"client_id": client_id}, {"_id": 0}):
        total_paid += float(p.get("amount", 0))
    return {
        "quoted": quoted,
        "paid": total_paid,
        "outstanding": max(quoted - total_paid, 0.0),
    }


async def enrich_client(c: dict) -> dict:
    c = clean_doc(c)
    money = await client_money(c["id"], float(c.get("quoted_value", 0)))
    c["money"] = money
    # days since contact
    lc = c.get("last_contact_at") or c.get("created_at")
    if lc:
        try:
            last = datetime.fromisoformat(lc.replace("Z", "+00:00"))
            days = (now_utc() - last).days
        except Exception:
            days = 0
    else:
        days = 0
    c["days_since_contact"] = days
    return c


# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user.get("name", "Owner")},
    }


@api.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.strip().lower()
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": name,
        "created_at": iso(now_utc()),
    })
    token = create_token(user_id, email)
    return {"token": token, "user": {"id": user_id, "email": email, "name": name}}


@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    import secrets
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email})
    # Always return a generic response to avoid user enumeration — but if user exists,
    # include the reset URL directly (since this build has no email integration).
    if not user:
        return {"ok": True, "message": "If an account exists, a reset link has been generated."}
    token = secrets.token_urlsafe(32)
    expires_at = now_utc() + timedelta(hours=1)
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["id"],
        "email": email,
        "expires_at": iso(expires_at),
        "used": False,
        "created_at": iso(now_utc()),
    })
    reset_path = f"/reset-password?token={token}"
    logger.info("Password reset requested for %s — token: %s", email, token)
    return {
        "ok": True,
        "message": "Reset link generated. In production this would be emailed — for now, use the link below.",
        "reset_token": token,
        "reset_path": reset_path,
        "expires_in_minutes": 60,
    }


@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    rec = await db.password_reset_tokens.find_one({"token": payload.token})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if rec.get("used"):
        raise HTTPException(status_code=400, detail="This reset link has already been used")
    try:
        exp = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
    except Exception:
        exp = now_utc() - timedelta(seconds=1)
    if now_utc() > exp:
        raise HTTPException(status_code=400, detail="This reset link has expired")
    await db.users.update_one(
        {"id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(payload.password)}},
    )
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"ok": True, "message": "Password updated. You can now sign in."}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------- Clients ----------
@api.get("/clients")
async def list_clients(user=Depends(get_current_user), stage: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if stage:
        query["stage"] = stage
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.clients.find(query, {"_id": 0}).sort("created_at", -1)
    results = []
    async for c in cursor:
        results.append(await enrich_client(c))
    return results


@api.post("/clients")
async def create_client(payload: ClientIn, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso(now_utc())
    doc["last_contact_at"] = doc["created_at"]
    await db.clients.insert_one(doc.copy())
    await add_interaction(doc["id"], "created", f"Client added — stage: {doc['stage']}")
    return await enrich_client(doc)


@api.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    return await enrich_client(c)


@api.put("/clients/{client_id}")
async def update_client(client_id: str, payload: ClientIn, user=Depends(get_current_user)):
    existing = await db.clients.find_one({"id": client_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")
    update = payload.model_dump()
    # Detect stage change
    stage_changed = existing.get("stage") != update.get("stage")
    await db.clients.update_one({"id": client_id}, {"$set": update})
    if stage_changed:
        await add_interaction(
            client_id,
            "stage_change",
            f"Stage changed: {existing.get('stage')} → {update['stage']}",
            {"from": existing.get("stage"), "to": update["stage"]},
        )
    c = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return await enrich_client(c)


@api.delete("/clients/{client_id}")
async def delete_client(client_id: str, user=Depends(get_current_user)):
    await db.clients.delete_one({"id": client_id})
    await db.interactions.delete_many({"client_id": client_id})
    await db.tasks.delete_many({"client_id": client_id})
    await db.payments.delete_many({"client_id": client_id})
    return {"ok": True}


@api.post("/clients/{client_id}/stage")
async def change_stage(client_id: str, payload: StageChangeIn, user=Depends(get_current_user)):
    existing = await db.clients.find_one({"id": client_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")
    from_stage = existing.get("stage")
    await db.clients.update_one({"id": client_id}, {"$set": {"stage": payload.stage}})
    inter = await add_interaction(
        client_id,
        "stage_change",
        f"Stage changed: {from_stage} → {payload.stage}",
        {"from": from_stage, "to": payload.stage},
    )
    return {"ok": True, "interaction": inter}


# ---------- Interactions / Timeline ----------
@api.post("/clients/{client_id}/interactions")
async def log_interaction(client_id: str, payload: InteractionIn, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    inter = await add_interaction(client_id, payload.type, payload.description, payload.meta)
    return inter


@api.get("/clients/{client_id}/timeline")
async def get_timeline(client_id: str, user=Depends(get_current_user)):
    events = []
    async for i in db.interactions.find({"client_id": client_id}, {"_id": 0}):
        events.append({**i, "event_kind": "interaction"})
    async for p in db.payments.find({"client_id": client_id}, {"_id": 0}):
        events.append({
            "id": p["id"],
            "client_id": client_id,
            "type": "payment",
            "description": f"Payment received: ₹{p['amount']} via {p['method']}" + (f" — {p['note']}" if p.get("note") else ""),
            "meta": {"amount": p["amount"], "method": p["method"]},
            "created_at": p.get("received_at") or p.get("created_at"),
            "event_kind": "payment",
        })
    async for t in db.tasks.find({"client_id": client_id, "completed": True}, {"_id": 0}):
        events.append({
            "id": f"task-{t['id']}",
            "client_id": client_id,
            "type": "task_completed",
            "description": f"Task completed: {t['title']}",
            "meta": {"task_id": t["id"]},
            "created_at": t.get("completed_at") or t.get("created_at"),
            "event_kind": "task",
        })
    events.sort(key=lambda e: e.get("created_at") or "", reverse=True)
    return events


# ---------- Tasks ----------
@api.get("/clients/{client_id}/tasks")
async def list_tasks(client_id: str, user=Depends(get_current_user)):
    tasks = []
    async for t in db.tasks.find({"client_id": client_id}, {"_id": 0}).sort("due_date", 1):
        tasks.append(t)
    return tasks


@api.post("/clients/{client_id}/tasks")
async def create_task(client_id: str, payload: TaskIn, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    doc = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "title": payload.title,
        "due_date": payload.due_date,
        "completed": False,
        "completed_at": None,
        "created_at": iso(now_utc()),
    }
    await db.tasks.insert_one(doc.copy())
    await add_interaction(client_id, "task_added", f"Task added: {payload.title}", {"task_id": doc["id"]})
    return clean_doc(doc)


@api.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, user=Depends(get_current_user)):
    t = await db.tasks.find_one({"id": task_id})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    completed_at = iso(now_utc())
    await db.tasks.update_one({"id": task_id}, {"$set": {"completed": True, "completed_at": completed_at}})
    await add_interaction(t["client_id"], "task_completed", f"Task completed: {t['title']}", {"task_id": task_id})
    return {"ok": True}


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user)):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ---------- Payments ----------
@api.get("/clients/{client_id}/payments")
async def list_payments(client_id: str, user=Depends(get_current_user)):
    out = []
    async for p in db.payments.find({"client_id": client_id}, {"_id": 0}).sort("received_at", -1):
        out.append(p)
    return out


@api.post("/clients/{client_id}/payments")
async def create_payment(client_id: str, payload: PaymentIn, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    doc = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "amount": float(payload.amount),
        "method": payload.method,
        "note": payload.note,
        "received_at": payload.received_at or iso(now_utc()),
        "created_at": iso(now_utc()),
    }
    await db.payments.insert_one(doc.copy())
    await add_interaction(
        client_id,
        "payment",
        f"Payment received: ₹{payload.amount:.0f} via {payload.method}" + (f" — {payload.note}" if payload.note else ""),
        {"amount": payload.amount, "method": payload.method},
    )
    return clean_doc(doc)


# ---------- Templates ----------
@api.get("/templates")
async def list_templates(user=Depends(get_current_user)):
    out = []
    async for t in db.templates.find({}, {"_id": 0}).sort("category", 1):
        out.append(t)
    return out


@api.post("/templates")
async def create_template(payload: TemplateIn, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso(now_utc())
    await db.templates.insert_one(doc.copy())
    return clean_doc(doc)


@api.put("/templates/{tid}")
async def update_template(tid: str, payload: TemplateIn, user=Depends(get_current_user)):
    await db.templates.update_one({"id": tid}, {"$set": payload.model_dump()})
    t = await db.templates.find_one({"id": tid}, {"_id": 0})
    return t


@api.delete("/templates/{tid}")
async def delete_template(tid: str, user=Depends(get_current_user)):
    await db.templates.delete_one({"id": tid})
    return {"ok": True}


# ---------- Dashboard: Needs Attention Today ----------
@api.get("/dashboard/attention")
async def attention(user=Depends(get_current_user)):
    settings = await get_settings()
    follow_up_days = settings.get("follow_up_lead_days", 3)
    quiet_days = settings.get("quiet_active_days", 7)
    today = now_utc()

    overdue_followups = []  # Leads with no follow-up in N days
    going_quiet = []  # Active (Signed / In Progress) with no activity in N days
    overdue_payments = []
    tasks_due = []

    clients = []
    async for c in db.clients.find({}, {"_id": 0}):
        clients.append(c)

    for c in clients:
        lc = c.get("last_contact_at") or c.get("created_at")
        try:
            last = datetime.fromisoformat(lc.replace("Z", "+00:00")) if lc else today
        except Exception:
            last = today
        days = (today - last).days
        stage = c.get("stage", "Lead")

        if stage == "Lead" and days >= follow_up_days:
            overdue_followups.append({
                "client_id": c["id"],
                "name": c["name"],
                "phone": c.get("phone", ""),
                "stage": stage,
                "days_since_contact": days,
                "preferred_language": c.get("preferred_language", "en"),
                "reason": f"No follow-up in {days} days",
                "category": "follow_up",
            })
        if stage in {"Signed", "In Progress"} and days >= quiet_days:
            going_quiet.append({
                "client_id": c["id"],
                "name": c["name"],
                "phone": c.get("phone", ""),
                "stage": stage,
                "days_since_contact": days,
                "preferred_language": c.get("preferred_language", "en"),
                "reason": f"Going quiet — {days} days silent",
                "category": "reengagement",
            })

        money = await client_money(c["id"], float(c.get("quoted_value", 0)))
        if money["outstanding"] > 0 and stage in OPEN_STAGES and stage != "Lead":
            # Age off balance, not contact recency. Priority:
            #  1) days since last payment received (if any payment exists)
            #  2) else days since stage_change → Signed (or subsequent paid stage)
            #  3) else days since client created
            outstanding_since = None
            last_payment = await db.payments.find_one(
                {"client_id": c["id"]}, {"_id": 0}, sort=[("received_at", -1)]
            )
            if last_payment:
                outstanding_since = last_payment.get("received_at") or last_payment.get("created_at")
            else:
                signed_inter = await db.interactions.find_one(
                    {"client_id": c["id"], "type": "stage_change", "meta.to": {"$in": ["Signed", "In Progress", "Delivered"]}},
                    {"_id": 0},
                    sort=[("created_at", -1)],
                )
                outstanding_since = (signed_inter or {}).get("created_at") or c.get("created_at")
            try:
                since_dt = datetime.fromisoformat(outstanding_since.replace("Z", "+00:00"))
                outstanding_days = (today - since_dt).days
            except Exception:
                outstanding_days = 0
            if outstanding_days >= 14:
                overdue_payments.append({
                    "client_id": c["id"],
                    "name": c["name"],
                    "phone": c.get("phone", ""),
                    "stage": stage,
                    "outstanding": money["outstanding"],
                    "quoted": money["quoted"],
                    "paid": money["paid"],
                    "outstanding_days": outstanding_days,
                    "preferred_language": c.get("preferred_language", "en"),
                    "reason": f"₹{money['outstanding']:.0f} outstanding for {outstanding_days} days",
                    "category": "payment_reminder",
                })

    # Tasks due today / overdue
    async for t in db.tasks.find({"completed": False}, {"_id": 0}):
        if not t.get("due_date"):
            continue
        try:
            due = datetime.fromisoformat(t["due_date"].replace("Z", "+00:00"))
        except Exception:
            continue
        if due <= today + timedelta(days=1):
            c = await db.clients.find_one({"id": t["client_id"]}, {"_id": 0})
            if not c:
                continue
            tasks_due.append({
                "task_id": t["id"],
                "client_id": c["id"],
                "name": c["name"],
                "phone": c.get("phone", ""),
                "title": t["title"],
                "due_date": t["due_date"],
                "preferred_language": c.get("preferred_language", "en"),
                "reason": "Task due" if due > today else "Task overdue",
                "overdue_days": max(0, (today - due).days),
                "category": "milestone_update",
            })

    # Ready for re-engagement — Past clients silent for 90+ days
    reengagement_ready = []
    for c in clients:
        if c.get("stage") != "Past":
            continue
        lc = c.get("last_contact_at") or c.get("created_at")
        try:
            last = datetime.fromisoformat(lc.replace("Z", "+00:00")) if lc else today
        except Exception:
            last = today
        gap = (today - last).days
        if gap >= 90:
            reengagement_ready.append({
                "client_id": c["id"],
                "name": c["name"],
                "phone": c.get("phone", ""),
                "stage": c.get("stage", "Past"),
                "days_since_contact": gap,
                "preferred_language": c.get("preferred_language", "en"),
                "reason": f"Delivered — {gap} days quiet, ready for a check-in",
                "category": "reengagement",
            })

    # Stats
    total_active = sum(1 for c in clients if c.get("stage") in OPEN_STAGES)
    pipeline_value = sum(float(c.get("quoted_value", 0)) for c in clients if c.get("stage") in OPEN_STAGES)
    total_leads = sum(1 for c in clients if c.get("stage") == "Lead")
    total_clients = len(clients)

    # This-month + this-week metrics
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Previous month range (for WoW deltas)
    if month_start.month == 1:
        prev_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        prev_month_start = month_start.replace(month=month_start.month - 1)
    week_ago = today - timedelta(days=7)

    revenue_this_month = 0.0
    revenue_last_month = 0.0
    revenue_all_time = 0.0
    async for p in db.payments.find({}, {"_id": 0}):
        try:
            when = datetime.fromisoformat((p.get("received_at") or p.get("created_at")).replace("Z", "+00:00"))
        except Exception:
            continue
        amt = float(p.get("amount", 0))
        revenue_all_time += amt
        if when >= month_start:
            revenue_this_month += amt
        elif when >= prev_month_start:
            revenue_last_month += amt

    # Total outstanding across open clients (money owed to owner)
    total_outstanding = 0.0
    for c in clients:
        if c.get("stage") in OPEN_STAGES:
            money = await client_money(c["id"], float(c.get("quoted_value", 0)))
            total_outstanding += money["outstanding"]

    # New leads in last 7 days
    new_leads_week = 0
    for c in clients:
        try:
            created = datetime.fromisoformat(c["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        if created >= week_ago:
            new_leads_week += 1

    # Signed / won this month (from interactions with stage_change → Signed)
    signed_this_month = 0
    signed_last_month = 0
    async for i in db.interactions.find({"type": "stage_change", "meta.to": "Signed"}, {"_id": 0}):
        try:
            when = datetime.fromisoformat(i["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        if when >= month_start:
            signed_this_month += 1
        elif when >= prev_month_start:
            signed_last_month += 1

    # Pipeline breakdown by stage (all stages)
    stage_settings_list = settings.get("stages", STAGES_DEFAULT)
    pipeline_by_stage = []
    for stage_name in stage_settings_list:
        count = sum(1 for c in clients if c.get("stage") == stage_name)
        value = sum(float(c.get("quoted_value", 0)) for c in clients if c.get("stage") == stage_name)
        pipeline_by_stage.append({"stage": stage_name, "count": count, "value": value})

    # Average deal size across signed+ clients
    won_values = [float(c.get("quoted_value", 0)) for c in clients if c.get("stage") in {"Signed", "In Progress", "Delivered"} and float(c.get("quoted_value", 0)) > 0]
    avg_deal_size = round(sum(won_values) / len(won_values), 0) if won_values else 0

    # Contact freshness — how many clients contacted in last 24h / 7d
    contacted_today = 0
    contacted_this_week = 0
    for c in clients:
        lc = c.get("last_contact_at") or c.get("created_at")
        try:
            last = datetime.fromisoformat(lc.replace("Z", "+00:00"))
        except Exception:
            continue
        delta = today - last
        if delta <= timedelta(hours=24):
            contacted_today += 1
        if delta <= timedelta(days=7):
            contacted_this_week += 1

    # 7-day contact activity sparkline (interactions per day, oldest first → today last)
    day_starts = [(today - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0) for i in range(6, -1, -1)]
    contacts_daily = [0] * 7
    async for i in db.interactions.find({}, {"_id": 0, "created_at": 1}):
        try:
            when = datetime.fromisoformat(i["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        if when < day_starts[0]:
            continue
        for idx in range(7):
            end = day_starts[idx] + timedelta(days=1)
            if day_starts[idx] <= when < end:
                contacts_daily[idx] += 1
                break

    # Relationships Rescued — clients where a message_sent in trailing 7 days
    # followed a period of silence >= follow_up_days (default 3), i.e., we
    # broke a real silence with a message.
    rescued_client_ids = set()
    async for msg in db.interactions.find({"type": "message_sent"}, {"_id": 0}):
        try:
            msg_when = datetime.fromisoformat(msg["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        if msg_when < week_ago:
            continue
        # Find previous interaction before this message
        prev = await db.interactions.find_one(
            {
                "client_id": msg["client_id"],
                "created_at": {"$lt": msg["created_at"]},
            },
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if not prev:
            continue
        try:
            prev_when = datetime.fromisoformat(prev["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        silence_days = (msg_when - prev_when).days
        if silence_days >= follow_up_days:
            rescued_client_ids.add(msg["client_id"])
    relationships_rescued = len(rescued_client_ids)

    return {
        "overdue_followups": overdue_followups,
        "going_quiet": going_quiet,
        "overdue_payments": overdue_payments,
        "tasks_due": tasks_due,
        "reengagement_ready": reengagement_ready,
        "stats": {
            "total_active": total_active,
            "pipeline_value": pipeline_value,
            "total_leads": total_leads,
            "total_clients": total_clients,
            "attention_count": (
                len(overdue_followups) + len(going_quiet) + len(overdue_payments)
                + len(tasks_due) + len(reengagement_ready)
            ),
            "revenue_this_month": revenue_this_month,
            "revenue_last_month": revenue_last_month,
            "revenue_all_time": revenue_all_time,
            "total_outstanding": total_outstanding,
            "new_leads_week": new_leads_week,
            "signed_this_month": signed_this_month,
            "signed_last_month": signed_last_month,
            "avg_deal_size": avg_deal_size,
            "contacted_today": contacted_today,
            "contacted_this_week": contacted_this_week,
            "contacts_daily": contacts_daily,
            "relationships_rescued": relationships_rescued,
        },
        "pipeline_by_stage": pipeline_by_stage,
        "settings": {"follow_up_lead_days": follow_up_days, "quiet_active_days": quiet_days},
    }


# ---------- Analytics ----------
@api.get("/analytics/summary")
async def analytics(user=Depends(get_current_user)):
    clients = []
    async for c in db.clients.find({}, {"_id": 0}):
        clients.append(c)

    total = len(clients)
    active = sum(1 for c in clients if c.get("stage") in OPEN_STAGES)
    pipeline = sum(float(c.get("quoted_value", 0)) for c in clients if c.get("stage") in OPEN_STAGES)

    # Revenue this month
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue_month = 0.0
    revenue_all = 0.0
    async for p in db.payments.find({}, {"_id": 0}):
        try:
            when = datetime.fromisoformat((p.get("received_at") or p.get("created_at")).replace("Z", "+00:00"))
        except Exception:
            continue
        revenue_all += float(p.get("amount", 0))
        if when >= month_start:
            revenue_month += float(p.get("amount", 0))

    # By stage
    by_stage = {}
    for c in clients:
        by_stage[c.get("stage", "Lead")] = by_stage.get(c.get("stage", "Lead"), 0) + 1

    # By source
    by_source = {}
    for c in clients:
        s = c.get("source", "Other")
        by_source[s] = by_source.get(s, 0) + 1

    # Conversion by source (signed or better / total)
    conv_source = {}
    for s in by_source.keys():
        total_s = sum(1 for c in clients if c.get("source") == s)
        won_s = sum(1 for c in clients if c.get("source") == s and c.get("stage") in {"Signed", "In Progress", "Delivered"})
        conv_source[s] = round((won_s / total_s) * 100, 1) if total_s else 0

    # Conversion by language
    conv_lang = {}
    for lang in ["en", "hi"]:
        total_l = sum(1 for c in clients if c.get("preferred_language") == lang)
        won_l = sum(1 for c in clients if c.get("preferred_language") == lang and c.get("stage") in {"Signed", "In Progress", "Delivered"})
        conv_lang[lang] = round((won_l / total_l) * 100, 1) if total_l else 0

    # Avg days Lead → Signed (from interactions with stage_change to "Signed")
    signed_durations = []
    async for i in db.interactions.find({"type": "stage_change", "meta.to": "Signed"}, {"_id": 0}):
        c = await db.clients.find_one({"id": i["client_id"]}, {"_id": 0})
        if not c:
            continue
        try:
            created = datetime.fromisoformat(c["created_at"].replace("Z", "+00:00"))
            signed = datetime.fromisoformat(i["created_at"].replace("Z", "+00:00"))
            signed_durations.append((signed - created).days)
        except Exception:
            pass
    avg_lead_to_signed = round(sum(signed_durations) / len(signed_durations), 1) if signed_durations else 0

    # Relationships Rescued (last 7 days) — clients where a message_sent broke silence >= 3 days
    week_ago = now_utc() - timedelta(days=7)
    settings = await get_settings()
    threshold_days = settings.get("follow_up_lead_days", 3)
    rescued_ids = set()
    async for msg in db.interactions.find({"type": "message_sent"}, {"_id": 0}):
        try:
            msg_when = datetime.fromisoformat(msg["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        if msg_when < week_ago:
            continue
        prev = await db.interactions.find_one(
            {"client_id": msg["client_id"], "created_at": {"$lt": msg["created_at"]}},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        if not prev:
            continue
        try:
            prev_when = datetime.fromisoformat(prev["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        if (msg_when - prev_when).days >= threshold_days:
            rescued_ids.add(msg["client_id"])
    relationships_rescued = len(rescued_ids)

    return {
        "totals": {
            "total_clients": total,
            "active_clients": active,
            "pipeline_value": pipeline,
            "revenue_month": revenue_month,
            "revenue_all": revenue_all,
            "avg_lead_to_signed_days": avg_lead_to_signed,
            "relationships_rescued": relationships_rescued,
            "rescue_window_days": 7,
            "rescue_threshold_days": threshold_days,
        },
        "by_stage": by_stage,
        "by_source": by_source,
        "conversion_by_source": conv_source,
        "conversion_by_language": conv_lang,
    }


# ---------- Settings ----------
@api.get("/settings")
async def read_settings(user=Depends(get_current_user)):
    return await get_settings()


@api.put("/settings")
async def update_settings(payload: SettingsIn, user=Depends(get_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.settings.update_one({"id": "singleton"}, {"$set": update}, upsert=True)
    return await get_settings()


# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "ClientPulse", "status": "ok"}


app.include_router(api)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup: Seed ----------
DEFAULT_TEMPLATES = [
    # Follow-up
    {"category": "follow_up", "language": "en", "name": "Follow-Up",
     "body": "Hi {name}, hope you're doing well. Just following up on our earlier conversation — would love to know your thoughts when you get a moment. Looking forward to hearing from you."},
    {"category": "follow_up", "language": "hi", "name": "फ़ॉलो-अप",
     "body": "नमस्ते {name} जी, आशा है आप कुशल हैं। हमारी पिछली बातचीत के संबंध में आपकी राय जानना चाहता हूँ। समय मिलने पर ज़रूर बताइयेगा। धन्यवाद।"},
    # Proposal sent
    {"category": "proposal_sent", "language": "en", "name": "Proposal Sent",
     "body": "Hi {name}, as discussed, I've shared the detailed proposal for your review. Please go through it at your convenience and let me know if any point needs clarification. Happy to hop on a quick call."},
    {"category": "proposal_sent", "language": "hi", "name": "प्रस्ताव भेजा गया",
     "body": "नमस्ते {name} जी, चर्चा अनुसार आपके अवलोकन हेतु विस्तृत प्रस्ताव भेज दिया है। कृपया देख कर बताइयेगा — कोई भी बिंदु स्पष्ट करना हो तो कॉल पर बात कर सकते हैं।"},
    # Signed confirmation
    {"category": "signed_confirmation", "language": "en", "name": "Signed — Kickoff",
     "body": "Hi {name}, thank you for placing your trust in us. Officially onboarding you today — we'll begin work on your project right away and share the first update by end of week."},
    {"category": "signed_confirmation", "language": "hi", "name": "साइनिंग — शुरुआत",
     "body": "नमस्ते {name} जी, आपके भरोसे के लिए हार्दिक धन्यवाद। आज से आपका प्रोजेक्ट औपचारिक रूप से शुरू कर रहे हैं — पहला अपडेट सप्ताह के अंत तक साझा कर देंगे।"},
    # Milestone update
    {"category": "milestone_update", "language": "en", "name": "Milestone Update",
     "body": "Hi {name}, quick update — {milestone} is now complete. Moving on to the next phase. Will share the next set of updates shortly."},
    {"category": "milestone_update", "language": "hi", "name": "माइलस्टोन अपडेट",
     "body": "नमस्ते {name} जी, एक अपडेट — {milestone} पूरा हो गया है। अब अगले चरण पर काम शुरू कर रहे हैं। शीघ्र ही अगली प्रगति साझा करेंगे।"},
    # Payment reminder
    {"category": "payment_reminder", "language": "en", "name": "Payment Reminder",
     "body": "Hi {name}, a gentle reminder — ₹{amount} is currently pending against your project. Kindly process at your earliest convenience so we can keep everything on track. Thank you."},
    {"category": "payment_reminder", "language": "hi", "name": "भुगतान अनुस्मारक",
     "body": "नमस्ते {name} जी, एक विनम्र अनुस्मारक — आपके प्रोजेक्ट के विरुद्ध ₹{amount} बाकी हैं। कृपया शीघ्र भुगतान की व्यवस्था करें ताकि कार्य निर्बाध जारी रहे। धन्यवाद।"},
    # Payment received
    {"category": "payment_received", "language": "en", "name": "Payment Received",
     "body": "Hi {name}, received ₹{amount} — thank you! Recorded on our end. Please consider this your confirmation, and do reach out if you need anything else."},
    {"category": "payment_received", "language": "hi", "name": "भुगतान प्राप्त",
     "body": "नमस्ते {name} जी, ₹{amount} प्राप्त हो गया — बहुत बहुत धन्यवाद! हमने रिकॉर्ड कर लिया है। आवश्यकता होने पर संकोच न करें।"},
    # Re-engagement
    {"category": "reengagement", "language": "en", "name": "Re-engagement Check-in",
     "body": "Hi {name}, it's been a while — hope everything is going great on your side. Just checking in to see if there's anything I can help with, or if you'd like to catch up briefly."},
    {"category": "reengagement", "language": "hi", "name": "पुनः संपर्क",
     "body": "नमस्ते {name} जी, काफ़ी समय बाद बात हो रही है — आशा है सब कुशल है। बस एक बार जानना चाहता था कि क्या कोई सहायता कर सकता हूँ, या फिर से बातचीत का अवसर बने।"},
]


DEMO_CLIENTS = [
    # Real signed client
    {"name": "Tuku's ZAARRAA", "phone": "+919876500001", "preferred_language": "en", "source": "Referral",
     "stage": "In Progress", "quoted_value": 45000, "notes": "Salon website — 3 sections built, homepage approved.",
     "days_ago": 30},
    # Fresh clinic lead — 4 days silent
    {"name": "Sunshine Family Clinic", "phone": "+919876500002", "preferred_language": "en", "source": "Cold Outreach",
     "stage": "Lead", "quoted_value": 0, "notes": "Reached out via LinkedIn — needs appointment-booking site.",
     "days_ago": 4},
    # Others
    {"name": "Mehta & Sons Interiors", "phone": "+919876500003", "preferred_language": "hi", "source": "Referral",
     "stage": "Negotiating", "quoted_value": 85000, "notes": "Discussed portfolio site + product catalog.",
     "days_ago": 2},
    {"name": "Priya's Yoga Studio", "phone": "+919876500004", "preferred_language": "hi", "source": "Instagram",
     "stage": "Signed", "quoted_value": 32000, "notes": "Booking calendar + membership plans.",
     "days_ago": 9},
    {"name": "Coastline Cafe", "phone": "+919876500005", "preferred_language": "en", "source": "Referral",
     "stage": "Pitched", "quoted_value": 22000, "notes": "Menu + reservation flow.", "days_ago": 1},
    {"name": "Rohan Photography", "phone": "+919876500006", "preferred_language": "en", "source": "Cold Outreach",
     "stage": "Delivered", "quoted_value": 28000, "notes": "Portfolio site launched last month.", "days_ago": 40},
    {"name": "Ganesh Sweets", "phone": "+919876500007", "preferred_language": "hi", "source": "Walk-in",
     "stage": "Lead", "quoted_value": 0, "notes": "Wants online ordering — needs first call.", "days_ago": 6},
    {"name": "Nikhil Legal Consultancy", "phone": "+919876500008", "preferred_language": "en", "source": "Referral",
     "stage": "In Progress", "quoted_value": 65000, "notes": "Firm site + blog CMS.", "days_ago": 12},
    {"name": "Aarohi Boutique", "phone": "+919876500009", "preferred_language": "hi", "source": "Instagram",
     "stage": "Pitched", "quoted_value": 38000, "notes": "E-com store — 40 SKUs.", "days_ago": 5},
    {"name": "Ravi Fitness", "phone": "+919876500010", "preferred_language": "en", "source": "Referral",
     "stage": "Past", "quoted_value": 18000, "notes": "Landing page delivered Jan 2025.", "days_ago": 120},
    {"name": "Shastri Tuitions", "phone": "+919876500011", "preferred_language": "hi", "source": "Cold Outreach",
     "stage": "Negotiating", "quoted_value": 24000, "notes": "Coaching site + student portal.", "days_ago": 3},
    {"name": "Blue Peak Travels", "phone": "+919876500012", "preferred_language": "en", "source": "Referral",
     "stage": "Signed", "quoted_value": 55000, "notes": "Tour packages + inquiry form.", "days_ago": 15},
    {"name": "Kavita Handicrafts", "phone": "+919876500013", "preferred_language": "hi", "source": "Instagram",
     "stage": "Lead", "quoted_value": 0, "notes": "Wants Shopify-style store.", "days_ago": 8},
    {"name": "Dr. Anand Dental", "phone": "+919876500014", "preferred_language": "en", "source": "Referral",
     "stage": "In Progress", "quoted_value": 42000, "notes": "Booking + services page. Homepage delivered.", "days_ago": 20},
    {"name": "Green Leaf Organics", "phone": "+919876500015", "preferred_language": "en", "source": "Cold Outreach",
     "stage": "Delivered", "quoted_value": 36000, "notes": "Store launched Dec 2025.", "days_ago": 60},
]


@app.on_event("startup")
async def startup_event():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.clients.create_index("id", unique=True)
    await db.interactions.create_index("client_id")
    await db.payments.create_index("client_id")
    await db.tasks.create_index("client_id")

    # Seed owner
    owner_email = os.environ["OWNER_EMAIL"].strip().lower()
    owner_pw = os.environ["OWNER_PASSWORD"]
    existing = await db.users.find_one({"email": owner_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": owner_email,
            "password_hash": hash_password(owner_pw),
            "name": os.environ.get("OWNER_NAME", "Raj"),
            "created_at": iso(now_utc()),
        })
        logger.info("Seeded owner user: %s", owner_email)
    elif not verify_password(owner_pw, existing["password_hash"]):
        await db.users.update_one({"email": owner_email}, {"$set": {"password_hash": hash_password(owner_pw)}})
        logger.info("Updated owner password from .env")

    # Seed settings
    await get_settings()

    # Seed templates if none
    tcount = await db.templates.count_documents({})
    if tcount == 0:
        for t in DEFAULT_TEMPLATES:
            doc = {**t, "id": str(uuid.uuid4()), "created_at": iso(now_utc())}
            await db.templates.insert_one(doc)
        logger.info("Seeded %d default templates", len(DEFAULT_TEMPLATES))

    # Seed demo clients if none
    ccount = await db.clients.count_documents({})
    if ccount == 0:
        for c in DEMO_CLIENTS:
            days_ago = c.pop("days_ago", 5)
            created = now_utc() - timedelta(days=days_ago)
            last_contact = created  # so 'days_since_contact' reflects intent
            cid = str(uuid.uuid4())
            doc = {
                **c,
                "id": cid,
                "created_at": iso(created),
                "last_contact_at": iso(last_contact),
            }
            await db.clients.insert_one(doc)
            # Add creation interaction
            await db.interactions.insert_one({
                "id": str(uuid.uuid4()),
                "client_id": cid,
                "type": "created",
                "description": f"Client added — stage: {doc['stage']}",
                "meta": {},
                "created_at": iso(created),
            })
            # For clients past "Signed", add a stage-change and a payment
            if doc["stage"] in {"Signed", "In Progress", "Delivered", "Past"}:
                signed_at = created + timedelta(days=max(1, days_ago // 3))
                await db.interactions.insert_one({
                    "id": str(uuid.uuid4()),
                    "client_id": cid,
                    "type": "stage_change",
                    "description": "Stage changed: Lead → Signed",
                    "meta": {"from": "Lead", "to": "Signed"},
                    "created_at": iso(signed_at),
                })
                # Add a partial or full payment
                pay_amount = doc["quoted_value"] * (1.0 if doc["stage"] in {"Delivered", "Past"} else 0.4)
                if pay_amount > 0:
                    await db.payments.insert_one({
                        "id": str(uuid.uuid4()),
                        "client_id": cid,
                        "amount": pay_amount,
                        "method": "UPI",
                        "note": "Advance received" if pay_amount < doc["quoted_value"] else "Full payment",
                        "received_at": iso(signed_at + timedelta(days=1)),
                        "created_at": iso(signed_at + timedelta(days=1)),
                    })
            # For Tuku's ZAARRAA — add the homepage milestone story
            if doc["name"] == "Tuku's ZAARRAA":
                m1 = created + timedelta(days=8)
                m2 = created + timedelta(days=18)
                await db.interactions.insert_one({
                    "id": str(uuid.uuid4()), "client_id": cid, "type": "milestone",
                    "description": "Milestone: Design mockups shared", "meta": {},
                    "created_at": iso(m1),
                })
                await db.interactions.insert_one({
                    "id": str(uuid.uuid4()), "client_id": cid, "type": "note",
                    "description": "Client feedback: loved the earth-tone palette",
                    "meta": {}, "created_at": iso(m2),
                })
                # Pending task
                await db.tasks.insert_one({
                    "id": str(uuid.uuid4()), "client_id": cid,
                    "title": "Build Services section",
                    "due_date": iso(now_utc() + timedelta(days=3)),
                    "completed": False, "completed_at": None,
                    "created_at": iso(now_utc() - timedelta(days=2)),
                })
        logger.info("Seeded %d demo clients", len(DEMO_CLIENTS))


@app.on_event("shutdown")
async def shutdown_event():
    mongo_client.close()
