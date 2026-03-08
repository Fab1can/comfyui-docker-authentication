# Architecture

## Service topology

```
┌──────────────────────────────────────────────┐
│                    Client                    │
│               (browser / API)                │
└───────────────────────┬──────────────────────┘
                        │ :HOST_PORT (default 8188)
                        ▼
┌──────────────────────────────────────────────┐
│               Nginx  (port 80)               │
│                                              │
│  /auth/*  ─────────────────► auth-server     │
│  /        ─── auth_request ► auth-server     │
│           └── (if valid)  ► comfyui          │
└──────────────────────────────────────────────┘
          │                           │
          ▼ :3001                     ▼ :8188 (internal)
┌─────────────────┐        ┌──────────────────────┐
│   auth-server   │        │       comfyui         │
│  (Node.js 20)   │        │  (PyTorch + NVIDIA)   │
└─────────────────┘        └──────────────────────┘
```

---

## Authentication flow

```
Client                  Nginx                auth-server          ComfyUI
  │                       │                      │                   │
  │  GET /auth/login       │                      │                   │
  │   ?otp=<OTP>          │                      │                   │
  │ ─────────────────────►│                      │                   │
  │                       │  proxy /login?otp=…  │                   │
  │                       │ ────────────────────►│                   │
  │                       │    200 + Set-Cookie  │                   │
  │                       │◄────────────────────  │                   │
  │◄──────────────────────│                      │                   │
  │  Cookie: jwt=<TOKEN>   │                      │                   │
  │                       │                      │                   │
  │  GET /                │                      │                   │
  │ (cookie sent)         │                      │                   │
  │ ─────────────────────►│                      │                   │
  │                       │  sub-request         │                   │
  │                       │  GET /_auth_request  │                   │
  │                       │ ────────────────────►│                   │
  │                       │       200 OK         │                   │
  │                       │◄────────────────────  │                   │
  │                       │  proxy to ComfyUI    │                   │
  │                       │ ────────────────────────────────────────►│
  │                       │                      │     200 OK        │
  │◄─────────────────────────────────────────────────────────────────│
```

### OTP rotation

The auth-server generates a random **5-digit OTP** on startup and regenerates it every `OTP_REGENERATION_INTERVAL` milliseconds (default 30 s).  
The current OTP is printed to the container log:

```
docker compose logs auth-server | grep "Current OTP"
```

---

## Token lifecycle

```
[login with OTP]
       │
       ▼
  JWT created  ──── stored in memory (validTokens[])
       │              ──── sent as HTTP-only cookie
       │
  [/verify called by nginx auth_request]
       │
       ▼
  token in validTokens? ─── yes ──► 200 OK
                       └─── no  ──► 401 Unauthorized
       │
  [/refresh]
       │
       ▼
  old token removed, new token issued and stored
       │
  [/logout]
       │
       ▼
  token removed from validTokens[], cookie cleared
```

---

## Data persistence

The ComfyUI workspace (models, outputs, workflows) is persisted via a bind-mount:

```yaml
volumes:
  - ./workspace:/workspace
```

The auth-server keeps the valid-token list **in memory only**; it is reset whenever the container restarts.

---

## Network

All services communicate over Docker's default bridge network (`docker compose` project network).  
The only externally exposed port is Nginx (`HOST_PORT`).  
`comfyui` and `auth-server` are not exposed to the host directly.
