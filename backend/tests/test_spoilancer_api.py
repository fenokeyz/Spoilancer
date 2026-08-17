"""Backend tests for Spoilancer API - root, auth, and advisor endpoints."""
import pytest


# --- Root ---
class TestRoot:
    def test_root_message(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert "Spoilancer" in data["message"]


# --- /api/auth/me ---
class TestAuthMe:
    def test_me_with_valid_token(self, auth_client, base_url):
        r = auth_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == "user_test123"
        assert data["email"] == "tester@spoilancer.app"
        assert "name" in data

    def test_me_no_auth_returns_401(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_me_bogus_token_returns_401(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": "Bearer this-is-not-a-real-token-xyz"},
        )
        assert r.status_code == 401, r.text


# --- /api/auth/session ---
class TestAuthSession:
    def test_session_bogus_id_returns_401(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/session",
            json={"session_id": "bogus-session-id-abc"},
        )
        assert r.status_code == 401, r.text


# --- /api/advisor/analyze ---
ADVISOR_PAYLOAD = {
    "stipend": 30000,
    "savings": 5000,
    "spoilance_limit": 5000,
    "currency": "INR",
    "templates": [
        {"title": "Coffee", "amount": 150, "description": "morning coffee", "weekday": 0},
        {"title": "Lunch", "amount": 250, "description": "office lunch", "weekday": 0},
    ],
    "recent_entries": [
        {"title": "Coffee", "limit": 150, "spent": 100, "weekday": 0},
        {"title": "Coffee", "limit": 150, "spent": 120, "weekday": 1},
        {"title": "Lunch", "limit": 250, "spent": 300, "weekday": 0},
    ],
    "spoilance_history": [
        {"month": "2025-11", "limit": 5000, "spent": 2000},
        {"month": "2025-12", "limit": 5000, "spent": 2500},
    ],
}


class TestAdvisor:
    def test_advisor_no_auth_returns_401(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/advisor/analyze", json=ADVISOR_PAYLOAD)
        assert r.status_code == 401, r.text

    @pytest.mark.timeout(120)
    def test_advisor_with_auth_returns_structured_json(self, auth_client, base_url):
        r = auth_client.post(
            f"{base_url}/api/advisor/analyze",
            json=ADVISOR_PAYLOAD,
            timeout=120,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:500]}"
        data = r.json()
        for key in ("summary", "overall_health", "limit_suggestions", "spoilance_suggestion", "tips"):
            assert key in data, f"missing key '{key}' in advisor response: {list(data.keys())}"
        assert isinstance(data["summary"], str) and len(data["summary"]) > 0
        assert isinstance(data["limit_suggestions"], list)
        assert isinstance(data["tips"], list)
