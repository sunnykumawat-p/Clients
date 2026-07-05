"""
ClientPulse — Backend API tests (iteration 2)

Covers Tier 1 baseline PLUS 8+2 targeted fixes:
  - Exactly 15 seed clients, exactly 14 templates, no TEST/PLAYWRIGHT/'Raj Kumawat' artifacts
  - /api/dashboard/attention.stats now returns: revenue_last_month, signed_last_month,
    contacts_daily (list[7]), relationships_rescued
  - /api/dashboard/attention.overdue_payments requires outstanding_days >= 14, includes outstanding_days field
  - /api/dashboard/attention.reengagement_ready includes Past-stage clients silent >= 90 days
  - /api/analytics/summary.totals includes relationships_rescued, rescue_window_days (=7),
    rescue_threshold_days (=3 by default)
  - Payment on an "aged" client removes it from overdue_payments; a fresh Signed
    with quoted_value > 0 does NOT immediately appear in overdue_payments
  - Task delete endpoint DELETE /api/tasks/{tid} works
  - Golden Rules regression: log payment → payment interaction on timeline; complete task → task_completed on timeline; stage change → stage_change on timeline

Run:
    pytest /app/backend/tests/backend_test.py -v --junitxml=/app/test_reports/pytest/pytest_results.xml
"""

import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

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
    def test_list_exactly_15_seed_clients_and_no_test_artifacts(self, auth_client):
        """Seed must be exactly 15, with no 'Raj Kumawat', 'TEST_*', or 'PLAYWRIGHT_*' leftover."""
        r = auth_client.get(f"{BASE_URL}/api/clients")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        names = [c["name"] for c in data]
        assert len(data) == 15, f"Expected exactly 15 seed clients, got {len(data)}: {names}"
        assert "Tuku's ZAARRAA" in names
        assert "Sunshine Family Clinic" in names
        assert "Ravi Fitness" in names
        assert "Raj Kumawat" not in names, f"Test client 'Raj Kumawat' still present: {names}"
        bad = [n for n in names if "TEST" in n or "PLAYWRIGHT" in n]
        assert not bad, f"Test artifacts left in clients: {bad}"
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

        r2 = auth_client.get(f"{BASE_URL}/api/clients/{cid}")
        assert r2.status_code == 200
        assert r2.json()["quoted_value"] == 10000

        r3 = auth_client.put(f"{BASE_URL}/api/clients/{cid}", json={**payload, "phone": "+919111111111"})
        assert r3.status_code == 200, r3.text
        r4 = auth_client.get(f"{BASE_URL}/api/clients/{cid}")
        assert r4.json()["phone"] == "+919111111111"

        r5 = auth_client.delete(f"{BASE_URL}/api/clients/{cid}")
        assert r5.status_code in (200, 204)
        r6 = auth_client.get(f"{BASE_URL}/api/clients/{cid}")
        assert r6.status_code == 404


# ---------- Stage change / interactions / timeline ----------
class TestStageAndTimeline:
    def test_stage_change_and_timeline(self, auth_client):
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

        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")

    def test_log_interaction(self, auth_client):
        payload = {"name": f"TEST_Note_{uuid.uuid4().hex[:6]}", "phone": "+919000000011", "preferred_language": "en", "stage": "Lead"}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]
        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/interactions", json={"type": "note", "description": "Test note"})
        assert r.status_code in (200, 201), r.text
        tl = auth_client.get(f"{BASE_URL}/api/clients/{cid}/timeline").json()
        assert any("Test note" in (e.get("description") or "") for e in tl)
        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")

    def test_message_sent_interaction_logged(self, auth_client):
        """WhatsAppDraft fire-and-forget POSTs a message_sent interaction; verify endpoint works with meta."""
        payload = {"name": f"TEST_Msg_{uuid.uuid4().hex[:6]}", "phone": "+919000000012", "preferred_language": "en", "stage": "Lead"}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]
        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/interactions",
                             json={"type": "message_sent", "description": "WhatsApp sent (EN): Hi tester",
                                   "meta": {"category": "follow_up", "language": "en"}})
        assert r.status_code in (200, 201), r.text
        tl = auth_client.get(f"{BASE_URL}/api/clients/{cid}/timeline").json()
        assert any(e.get("type") == "message_sent" for e in tl)
        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")


# ---------- Tasks ----------
class TestTasks:
    def test_create_complete_and_delete_task(self, auth_client):
        payload = {"name": f"TEST_Task_{uuid.uuid4().hex[:6]}", "phone": "+919000000020", "preferred_language": "en", "stage": "In Progress"}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]

        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/tasks", json={"title": "TEST task", "due_date": None})
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]

        # list
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

        # NEW: delete task endpoint (used by ClientProfile Tasks tab)
        # Create a second pending task and DELETE it
        r5 = auth_client.post(f"{BASE_URL}/api/clients/{cid}/tasks", json={"title": "TEST task to delete", "due_date": None})
        assert r5.status_code in (200, 201)
        tid2 = r5.json()["id"]
        r6 = auth_client.delete(f"{BASE_URL}/api/tasks/{tid2}")
        assert r6.status_code in (200, 204), f"DELETE /api/tasks/{{tid}} failed: {r6.status_code} {r6.text}"
        remaining = auth_client.get(f"{BASE_URL}/api/clients/{cid}/tasks").json()
        assert not any(t["id"] == tid2 for t in remaining), "Task not actually deleted"

        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")


# ---------- Payments (Golden Rule: log payment triggers timeline; outstanding updates) ----------
class TestPayments:
    def test_log_payment_updates_outstanding(self, auth_client):
        payload = {"name": f"TEST_Pay_{uuid.uuid4().hex[:6]}", "phone": "+919000000030", "preferred_language": "en", "stage": "Signed", "quoted_value": 20000}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]

        r = auth_client.post(f"{BASE_URL}/api/clients/{cid}/payments", json={"amount": 5000, "method": "UPI"})
        assert r.status_code in (200, 201), r.text

        r2 = auth_client.get(f"{BASE_URL}/api/clients/{cid}/payments")
        assert r2.status_code == 200
        assert any(p["amount"] == 5000 for p in r2.json())

        client = auth_client.get(f"{BASE_URL}/api/clients/{cid}").json()
        assert client.get("money", {}).get("paid") == 5000
        assert client.get("money", {}).get("outstanding") == 15000
        tl = auth_client.get(f"{BASE_URL}/api/clients/{cid}/timeline").json()
        assert any("payment" in (e.get("type") or "").lower() for e in tl)
        auth_client.delete(f"{BASE_URL}/api/clients/{cid}")


# ---------- Templates ----------
class TestTemplates:
    def test_exactly_14_seeded_templates_and_no_test_artifacts(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/templates")
        assert r.status_code == 200
        tpls = r.json()
        assert len(tpls) == 14, f"Expected exactly 14 seed templates, got {len(tpls)}: {[t['name'] for t in tpls]}"
        bad = [t["name"] for t in tpls if "TEST" in t["name"] or "PLAYWRIGHT" in t["name"]]
        assert not bad, f"Test artifacts in templates: {bad}"
        langs = {t.get("language") for t in tpls}
        assert langs == {"en", "hi"}
        cats = {t.get("category") for t in tpls}
        assert len(cats) >= 7, f"Expected >=7 categories, got {cats}"

    def test_template_crud(self, auth_client):
        payload = {"name": f"TEST_TPL_{uuid.uuid4().hex[:6]}", "category": "custom", "language": "en", "body": "Hi {name}, this is a test."}
        r = auth_client.post(f"{BASE_URL}/api/templates", json=payload)
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]

        r2 = auth_client.put(f"{BASE_URL}/api/templates/{tid}", json={**payload, "body": "Hi {name}, updated."})
        assert r2.status_code == 200, r2.text
        r3 = auth_client.get(f"{BASE_URL}/api/templates").json()
        upd = [t for t in r3 if t["id"] == tid][0]
        assert "updated" in upd["body"]

        r4 = auth_client.delete(f"{BASE_URL}/api/templates/{tid}")
        assert r4.status_code in (200, 204)
        r5 = auth_client.get(f"{BASE_URL}/api/templates").json()
        assert not any(t["id"] == tid for t in r5)


# ---------- Dashboard attention — new shape ----------
class TestDashboardAttention:
    def test_attention_shape_has_new_stats(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/dashboard/attention")
        assert r.status_code == 200
        data = r.json()
        for k in ("overdue_followups", "going_quiet", "overdue_payments", "tasks_due", "reengagement_ready", "stats"):
            assert k in data, f"missing key: {k}"
        stats = data["stats"]
        for k in ("total_active", "pipeline_value", "total_leads", "attention_count",
                  "revenue_last_month", "revenue_this_month",
                  "signed_last_month", "signed_this_month",
                  "contacts_daily", "relationships_rescued"):
            assert k in stats, f"missing stat: {k}"

        # Sparkline is exactly 7 numbers, oldest → today
        cd = stats["contacts_daily"]
        assert isinstance(cd, list) and len(cd) == 7, f"contacts_daily must be a 7-element list, got {cd}"
        assert all(isinstance(v, (int, float)) for v in cd)

        # relationships_rescued is an integer
        assert isinstance(stats["relationships_rescued"], int)

        # Data types on WoW fields
        assert isinstance(stats["revenue_last_month"], (int, float))
        assert isinstance(stats["signed_last_month"], int)

    def test_reengagement_ready_contains_ravi_fitness(self, auth_client):
        """Ravi Fitness (Past, 120 days quiet) must appear in reengagement_ready."""
        r = auth_client.get(f"{BASE_URL}/api/dashboard/attention")
        assert r.status_code == 200
        rr = r.json()["reengagement_ready"]
        names = [x["name"] for x in rr]
        assert "Ravi Fitness" in names, f"Ravi Fitness missing from reengagement_ready: {names}"
        # Each row must expose days_since_contact and be Past stage
        ravi = next(x for x in rr if x["name"] == "Ravi Fitness")
        assert ravi["stage"] == "Past"
        assert ravi["days_since_contact"] >= 90

    def test_overdue_followups_and_going_quiet_shape(self, auth_client):
        """Shape check only — seed clients may have had their last_contact_at bumped by
        previous WhatsApp-send tests, so we only validate structure, not membership."""
        r = auth_client.get(f"{BASE_URL}/api/dashboard/attention").json()
        assert isinstance(r["overdue_followups"], list)
        for c in r["overdue_followups"]:
            assert c["stage"] == "Lead"
            assert "days_since_contact" in c and c["days_since_contact"] >= 3
        assert isinstance(r["going_quiet"], list)
        for c in r["going_quiet"]:
            assert c["stage"] in {"Signed", "In Progress"}
            assert "days_since_contact" in c and c["days_since_contact"] >= 7

    def test_overdue_payments_only_after_14_days_aging(self, auth_client):
        """A fresh Signed client with quoted_value > 0 and NO payment must NOT appear in overdue_payments."""
        payload = {"name": f"TEST_Fresh_{uuid.uuid4().hex[:6]}", "phone": "+919000000040",
                   "preferred_language": "en", "stage": "Signed", "quoted_value": 50000}
        cid = auth_client.post(f"{BASE_URL}/api/clients", json=payload).json()["id"]
        try:
            r = auth_client.get(f"{BASE_URL}/api/dashboard/attention").json()
            names = [c["name"] for c in r["overdue_payments"]]
            assert payload["name"] not in names, \
                f"Fresh Signed client should NOT be in overdue_payments (needs 14+ days aging); found: {names}"
            # Every item that IS present must expose outstanding_days
            for item in r["overdue_payments"]:
                assert "outstanding_days" in item, f"overdue_payments missing outstanding_days: {item}"
                assert item["outstanding_days"] >= 14
        finally:
            auth_client.delete(f"{BASE_URL}/api/clients/{cid}")

    def test_payment_removes_from_overdue(self, auth_client):
        """Log a payment on a client and ensure they don't appear in overdue_payments after (payment reset ages timer)."""
        # Use existing seeded client that could be overdue (Tuku's ZAARRAA) — after payment their last_payment date
        # becomes fresh, so outstanding_days should reset to 0 and they're removed from overdue_payments.
        r0 = auth_client.get(f"{BASE_URL}/api/clients").json()
        tuku = next(c for c in r0 if c["name"] == "Tuku's ZAARRAA")

        # Log a small payment
        pr = auth_client.post(f"{BASE_URL}/api/clients/{tuku['id']}/payments",
                              json={"amount": 100, "method": "UPI"})
        assert pr.status_code in (200, 201), pr.text
        pay_id = pr.json().get("id")

        att = auth_client.get(f"{BASE_URL}/api/dashboard/attention").json()
        names_overdue = [c["name"] for c in att["overdue_payments"]]
        assert "Tuku's ZAARRAA" not in names_overdue, \
            f"Client with fresh payment should be removed from overdue_payments; found: {names_overdue}"

    def test_attention_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/dashboard/attention")
        assert r.status_code == 401


# ---------- Analytics — new totals fields ----------
class TestAnalytics:
    def test_analytics_summary_has_rescued_fields(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/analytics/summary")
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data
        t = data["totals"]
        for k in ("total_clients", "active_clients", "pipeline_value", "revenue_month",
                  "avg_lead_to_signed_days",
                  "relationships_rescued", "rescue_window_days", "rescue_threshold_days"):
            assert k in t, f"missing totals key: {k}"
        assert isinstance(t["relationships_rescued"], int)
        assert t["rescue_window_days"] == 7, f"expected rescue_window_days=7, got {t['rescue_window_days']}"
        # rescue_threshold_days defaults from settings.follow_up_lead_days (default 3)
        assert isinstance(t["rescue_threshold_days"], int)
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
