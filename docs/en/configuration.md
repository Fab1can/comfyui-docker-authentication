# Configuration Reference

All configuration is supplied via environment variables. The table below lists every variable, the file where it is typically set, its default value, and its purpose.

---

## Root environment (`.env`)

| Variable | Default | Description |
|---|---|---|
| `HOST_PORT` | `8188` | Host port mapped to Nginx container port 80 |

Set in the root `.env` file and referenced by `docker-compose.yml`:
```yaml
ports:
  - "${HOST_PORT}:80"
```

---

## Auth-server environment (`auth-server/.env` or `docker-compose.yml`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the Express server listens on inside the container |
| `JWT_SECRET` | `change-this-secret-key` | HMAC secret used to sign and verify JWTs. **Must be changed in production.** |
| `JWT_EXPIRATION` | `7d` | Token lifetime. Accepts `jsonwebtoken` duration strings: `30s`, `15m`, `2h`, `7d` |
| `OTP_REGENERATION_INTERVAL` | `30000` | Milliseconds between OTP rotations (default: 30 seconds) |
| `MAX_LOGIN_ATTEMPTS` | `5` | Maximum failed login attempts before lockout |
| `MAX_LOGIN_ATTEMPTS_TIME_WINDOW` | `600000` | Milliseconds in which failed attempts are counted (default: 10 minutes) |
| `LOCKOUT_DURATION` | `600000` | Milliseconds an IP remains locked out after exceeding the attempt limit (default: 10 minutes) |
| `COMFYUI_HOST` | `http://comfyui:8188` | Internal address of the ComfyUI service (informational, not used in server.js directly) |
| `NODE_ENV` | — | Set to `production` in `docker-compose.yml`; enables `secure` flag on the JWT cookie |

---

## Setting secrets securely

### Option 1 — Root `.env` file (recommended for local use)

```ini
# .env  (gitignored by default)
HOST_PORT=8188
JWT_SECRET=a-very-long-random-string-at-least-32-chars
```

### Option 2 — Inline in `docker-compose.yml`

```yaml
auth-server:
  environment:
    - JWT_SECRET=a-very-long-random-string-at-least-32-chars
    - JWT_EXPIRATION=1d
```

### Option 3 — Docker secrets (production / Swarm)

For production deployments, use Docker secrets or a secrets manager instead of plain-text variables.

---

## JWT expiration format

The `JWT_EXPIRATION` variable uses the `jsonwebtoken` library format:

| Value | Meaning |
|---|---|
| `60` | 60 seconds |
| `15m` | 15 minutes |
| `2h` | 2 hours |
| `7d` | 7 days (default) |
| `30d` | 30 days |

---

## Rate limiting tuning

The default values allow **5 failed attempts** within any **10-minute window** before blocking that IP for **10 minutes**:

```
MAX_LOGIN_ATTEMPTS=5
MAX_LOGIN_ATTEMPTS_TIME_WINDOW=600000   # 10 min in ms
LOCKOUT_DURATION=600000                 # 10 min in ms
```

To tighten security (e.g. allow only 3 attempts, 30-minute lockout):

```ini
MAX_LOGIN_ATTEMPTS=3
LOCKOUT_DURATION=1800000
```
