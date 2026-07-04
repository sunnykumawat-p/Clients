"""
ClientPulse — Backend API tests
Covers: auth (login, /me, invalid), clients CRUD, stage change, interactions/timeline,
tasks (create+complete), payments, templates (CRUD), dashboard/attention, analytics, settings.
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://high-touch-clients.preview.emergentagent.com"

OWNER_EMAIL = "owner@clientpulse.app"
OWNER_PASSWORD = "pulse2026"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_client(api_client, auth_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"})
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["email"] == OWNER_EMAIL
        assert "id" in data["user"]

    def test_login_invalid_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_invalid_email(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "nobody@x.com", "password": "pulse2026"})
        assert r.status_code == 401

    def test_me_protected(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_success(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == OWNER_EMAIL

    def test_me_invalid_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer badtoken"})
        assert r.status_code == 401


# ---------- Clients ----------
class TestClients:
    def test_list_seeded_clients(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 15, f"Expected at least 15 seed clients, got {len(data)}"
        names = [c["name"] for c in data]
        assert "Tuku's ZAARRAA" in names
        assert "Sunshine Family Clinic" in names
        # Ensure _id excluded
        assert all("_id" not in c for c in data)

    def test_get_client_by_id(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/clients")
        tuku = next(c for c in r.json() if c["name"] == "Tuku's ZAARRAA")
        r2 = auth_client.get(f"{BASE_URL}/api/clients/{tuku['id']}")
        assert r2.status_code == 200
        assert r2.json()["name"] == "Tuku's ZAARRAA"
        assert r2.json()["stage"] == "In Progress"

    def test_create_update_delete_client(self, auth_client):
        payload = {
            "name": f"TEST_Client_{uuid.uuid4().hex[:6]}",
            "phone": "+919000000000",
            "preferred_language": "en",
            "stage": "Lead",
            "source": "Referral",
            "quoted_value": 10000,
        }
        r = auth_client.post(f"{BASE_URL}/api/clients", json=payload)
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        assert r.json()["name"] == payload["name"]

        # GET verifies persistence
        r2 = auth_client.get(f"{BASE_URL}/api/clients/{cid}")
        assert r2.status_code == 200
        assert r2.json()["quoted_value"] == 10000

        # UPDATE — PUT accepts full ClientIn body
        r3 = auth_client.put(f"{BASE_URL}/api/clients/{cid}", json={**payload, "phone": "+919111111111"})
        assert r3.status_code == 200, r3.text
        r4 = auth_client.get(f"{BASE_URL}/api/clients/{cid}")
        assert r4.json()["phone"] == "+919111111111"

        # DELETE
        r5 = auth_client.delete(f"{BASE_URL}/api/clients/{cid}")
        assert r5.status_code in (200, 204)
        r6 = auth_client.get(f"{BASE_URL}/api/clients/{cid}")
        assert r6.status_code == 404


# ---------- Stage change / interactions / timeline ----------
class TestStageAndTimeline:
    def test_stage_change_and_timeline(self, auth_client):
        # Create a fresh test client to avoid mutating seeds
        payload = {"name": f"TEST_Stage_{uuid.uuid4().hex[:6]}", "phone": "+919000000010", "preferred_language": "en", "stage": "Lead"}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]

        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/stage", json={"stage": "Pitched"})
        assert r.status_code == 200, r.text

        r2 = auth_client.get(f"{BASE_URL}/api/clients/{cid}")
        assert r2.json()["stage"] == "Pitched"

        r3 = auth_client.get(f"{BASE_URL}/api/clients/{cid}/timeline")
        assert r3.status_code == 200
        events = r3.json()
        assert any(e.get("type") == "stage_change" for e in events), f"No stage_change in timeline: {events}"

        # cleanup
        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")

    def test_log_interaction(self, auth_client):
        payload = {"name": f"TEST_Note_{uuid.uuid4().hex[:6]}", "phone": "+919000000011", "preferred_language": "en", "stage": "Lead"}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]
        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/interactions", json={"type": "note", "description": "Test note"})
        assert r.status_code in (200, 201), r.text
        tl = auth_client.get(f"{BASE_URL}/api/clients/{cid}/timeline").json()
        assert any("Test note" in (e.get("description") or "") for e in tl)
        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")


# ---------- Tasks ----------
class TestTasks:
    def test_create_and_complete_task(self, auth_client):
        payload = {"name": f"TEST_Task_{uuid.uuid4().hex[:6]}", "phone": "+919000000020", "preferred_language": "en", "stage": "In Progress"}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]

        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/tasks", json={"title": "TEST task", "due_date": None})
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]

        # list tasks
        r2 = auth_client.get(f"{BASE_URL}/api/clients/{cid}/tasks")
        assert r2.status_code == 200
        assert any(t["id"] == tid for t in r2.json())

        # complete
        r3 = auth_client.post(f"{BASE_URL}/api/tasks/{tid}/complete")
        assert r3.status_code == 200, r3.text

        r4 = auth_client.get(f"{BASE_URL}/api/clients/{cid}/tasks")
        done = [t for t in r4.json() if t["id"] == tid][0]
        assert done.get("status") in ("done", "completed") or done.get("completed") is True or done.get("completed_at")

        tl = auth_client.get(f"{BASE_URL}/api/clients/{cid}/timeline").json()
        assert any("task" in (e.get("type") or "").lower() for e in tl), "Task event not in timeline"
        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")


# ---------- Payments ----------
class TestPayments:
    def test_log_payment_updates_outstanding(self, auth_client):
        payload = {"name": f"TEST_Pay_{uuid.uuid4().hex[:6]}", "phone": "+919000000030", "preferred_language": "en", "stage": "Signed", "quoted_value": 20000}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]

        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/payments", json={"amount": 5000, "method": "UPI"})
        assert r.status_code in (200, 201), r.text

        # verify payments list
        r2 = auth_client.get(f"{BASE_URL}/api/clients/{cid}/payments")
        assert r2.status_code == 200
        assert any(p["amount"] == 5000 for p in r2.json())

        # verify client outstanding via enriched money object
        client = auth_client.get(f"{BASE_URL}/api/clients/{cid}").json()
        assert client.get("money", {}).get("paid") == 5000
        assert client.get("money", {}).get("outstanding") == 15000
        # timeline has payment
        tl = auth_client.get(f"{BASE_URL}/api/clients/{cid}/timeline").json()
        assert any("payment" in (e.get("type") or "").lower() for e in tl)
        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")


# ---------- Templates ----------
class TestTemplates:
    def test_seeded_templates(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/templates")
        assert r.status_code == 200
        tpls = r.json()
        assert len(tpls) >= 14, f"Expected >=14 seed templates, got {len(tpls)}"
        langs = {t.get("language") for t in tpls}
        assert "en" in langs and "hi" in langs
        cats = {t.get("category") for t in tpls}
        assert len(cats) >= 7, f"Expected >=7 categories, got {cats}"

    def test_template_crud(self, auth_client):
        payload = {"name": f"TEST_TPL_{uuid.uuid4().hex[:6]}", "category": "custom", "language": "en", "body": "Hi {name}, this is a test."}
        r = auth_client.post(f"{BASE_URL}/api/templates", json=payload)
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]

        # update - PUT requires full TemplateIn body
        r2 = auth_client.put(f"{BASE_URL}/api/templates/{tid}", json={**payload, "body": "Hi {name}, updated."})
        assert r2.status_code == 200, r2.text
        r3 = auth_client.get(f"{BASE_URL}/api/templates").json()
        upd = [t for t in r3 if t["id"] == tid][0]
        assert "updated" in upd["body"]

        # delete
        r4 = auth_client.delete(f"{BASE_URL}/api/templates/{tid}")
        assert r4.status_code in (200, 204)
        r5 = auth_client.get(f"{BASE_URL}/api/templates").json()
        assert not any(t["id"] == tid for t in r5)


# ---------- Dashboard attention ----------
class TestDashboard:
    def test_attention_shape(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/dashboard/attention")
        assert r.status_code == 200
        data = r.json()
        for k in ("overdue_followups", "going_quiet", "overdue_payments", "tasks_due", "stats"):
            assert k in data, f"missing key: {k}"
        stats = data["stats"]
        for k in ("total_active", "pipeline_value", "total_leads", "attention_count"):
            assert k in stats, f"missing stat: {k} in {stats}"
        # Sunshine Family Clinic (4-day-old Lead) should be in overdue_followups
        assert any(c["name"] == "Sunshine Family Clinic" for c in data["overdue_followups"])
        # Tuku's ZAARRAA should appear in going_quiet
        assert any(c["name"] == "Tuku's ZAARRAA" for c in data["going_quiet"])

    def test_attention_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dashboard/attention")
        assert r.status_code == 401


# ---------- Analytics ----------
class TestAnalytics:
    def test_analytics_summary(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/analytics/summary")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        assert "totals" in data
        totals = data["totals"]
        for k in ("total_clients", "active_clients", "pipeline_value", "revenue_month", "avg_lead_to_signed_days"):
            assert k in totals, f"missing totals key: {k}"
        for k in ("by_stage", "by_source", "conversion_by_source", "conversion_by_language"):
            assert k in data, f"missing chart data: {k}"


# ---------- Settings ----------
class TestSettings:
    def test_get_settings(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert "stages" in data and isinstance(data["stages"], list)
        assert "follow_up_lead_days" in data
        assert "quiet_active_days" in data

    def test_update_settings_persists(self, auth_client):
        original = auth_client.get(f"{BASE_URL}/api/settings").json()
        new_followup = 5
        new_quiet = 10
        r = auth_client.put(f"{BASE_URL}/api/settings", json={"follow_up_lead_days": new_followup, "quiet_active_days": new_quiet})
        assert r.status_code == 200, r.text
        after = auth_client.get(f"{BASE_URL}/api/settings").json()
        assert after["follow_up_lead_days"] == new_followup
        assert after["quiet_active_days"] == new_quiet
        # restore
        auth_client.put(f"{BASE_URL}/api/settings", json={
            "follow_up_lead_days": original["follow_up_lead_days"],
            "quiet_active_days": original["quiet_active_days"],
        })
