# ClientPulse Auth Testing

Auth scheme: JWT bearer token in `Authorization` header. Stored in localStorage on frontend.

## Endpoints
- POST /api/auth/login  → body `{email, password}` → returns `{token, user}`
- GET  /api/auth/me     → header `Authorization: Bearer <token>` → returns user

## Owner Credentials
- Email: owner@clientpulse.app
- Password: pulse2026

## Curl Verification
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"owner@clientpulse.app","password":"pulse2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "$API/api/auth/me" -H "Authorization: Bearer $TOKEN"
```
Expected: user object with email owner@clientpulse.app.
