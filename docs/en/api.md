# API Reference

All endpoints are exposed through Nginx at `http://<host>:HOST_PORT/auth/`.  
The auth-server internally listens on port 3001.

---

## Endpoint overview

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/login` | None | Exchange OTP for JWT cookie |
| `GET` | `/auth/logout` | Bearer token | Revoke token and clear cookie |
| `GET` | `/auth/verify` | Bearer token | Validate token (used internally by Nginx) |
| `GET` | `/auth/refresh` | Bearer token | Rotate token |
| `GET` | `/auth/health` | None | Service health check |

---

## `GET /auth/login`

Authenticate with the current OTP and receive a JWT stored as an HTTP-only cookie.

### Query parameters

| Name | Required | Description |
|---|---|---|
| `otp` | Yes | Current 5-digit OTP (read from container logs) |

### Success response — `200 OK`

```json
{ "message": "Login successful" }
```

Response also sets:

```
Set-Cookie: jwt=<TOKEN>; Path=/; HttpOnly; SameSite=Strict; Max-Age=<seconds>
```

### Error responses

| Status | Condition |
|---|---|
| `401 Unauthorized` | OTP is incorrect |
| `429 Too Many Requests` | IP has exceeded `MAX_LOGIN_ATTEMPTS` |

### Example

```bash
curl -c cookies.txt \
  "http://localhost:8188/auth/login?otp=47391"
```

---

## `GET /auth/logout`

Revoke the current token and clear the cookie.

### Headers

```
Authorization: Bearer <token>
```

### Success response — `200 OK`

```json
{ "message": "Logged out successfully" }
```

Response also sets:

```
Set-Cookie: jwt=; Max-Age=0
```

### Error responses

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token provided, or token is invalid / expired |

### Example

```bash
curl -b cookies.txt \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8188/auth/logout"
```

---

## `GET /auth/verify`

Check whether a token is valid and has not been revoked.  
This endpoint is called by Nginx's `auth_request` directive for every protected request; it is not typically called directly by clients.

### Headers

```
Authorization: Bearer <token>
```

### Success response — `200 OK`

```json
{ "valid": true, "token": "<token>" }
```

### Error responses

| Status | Condition |
|---|---|
| `401 Unauthorized` | Token missing, invalid, expired, or revoked |

---

## `GET /auth/refresh`

Issue a new token in exchange for a valid existing token.  
The old token is revoked and the new token is set as a cookie.

### Headers

```
Authorization: Bearer <token>
```

### Success response — `200 OK`

```json
{ "message": "Token refreshed", "token": "<new_token>" }
```

Response also sets a new `jwt` cookie.

### Error responses

| Status | Condition |
|---|---|
| `401 Unauthorized` | Token missing, invalid, or expired |

### Example

```bash
curl -b cookies.txt -c cookies.txt \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8188/auth/refresh"
```

---

## `GET /auth/health`

Returns service status. No authentication required.

### Success response — `200 OK`

```json
{ "status": "ok" }
```

### Example

```bash
curl "http://localhost:8188/auth/health"
```

---

## Using the JWT in requests

Once logged in, the `jwt` cookie is sent automatically by the browser on every request.  
For programmatic clients that cannot use cookies, pass the token as a `Bearer` header:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8188/"
```

> Nginx extracts the cookie value and forwards it as a `Bearer` header to both the auth-server (`/_auth_request`) and ComfyUI (`/`).
