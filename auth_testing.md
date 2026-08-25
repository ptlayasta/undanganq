# Auth Testing Playbook (from Emergent Auth playbook)

## Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Backend API test
```
curl -X GET "$API/api/auth/me" -H "Authorization: Bearer $SESSION_TOKEN"
curl -X POST "$API/api/events" -H "Content-Type: application/json" -H "Authorization: Bearer $SESSION_TOKEN" -d '{"title":"Andi & Rina","event_type":"wedding","template_id":"elegant-rose"}'
```

## Step 3: Browser cookie
```
await page.context.add_cookies([{
    "name": "session_token", "value": SESSION_TOKEN,
    "domain": "invite-subur.preview.emergentagent.com", "path": "/",
    "httpOnly": True, "secure": True, "sameSite": "None"
}])
```

Notes:
- User documents have `user_id` field (custom UUID), MongoDB's `_id` is separate.
- All queries in backend use `{"_id": 0}` projection.
- Session cookie name is `session_token`.
- Callback route is `/dashboard#session_id=...` handled by `AppRouter` synchronously via `useLocation().hash`.
