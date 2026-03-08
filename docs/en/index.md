# ComfyUI Docker Authentication — Project Overview

ComfyUI Docker Authentication is a containerised security layer that adds **OTP-based login and JWT-protected access** to a [ComfyUI](https://github.com/comfyanonymous/ComfyUI) instance.  
Every HTTP request (including WebSocket upgrades) is intercepted by Nginx, which forwards an auth-sub-request to a lightweight Express.js service before letting the traffic reach ComfyUI.

---

## Documentation index

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Service topology, request flow, data model |
| [Auth Server](auth-server.md) | Source code walkthrough of `auth-server/server.js` |
| [Nginx](nginx.md) | Reverse-proxy configuration explained line by line |
| [Configuration](configuration.md) | All environment variables and their defaults |
| [API Reference](api.md) | Complete endpoint reference with examples |
| [Deployment](deployment.md) | Step-by-step setup and operational guide |

---

## Services at a glance

| Service | Image / Source | Internal port | Purpose |
|---|---|---|---|
| `comfyui` | `zeroclue/comfyui:ultra-slim-torch2.8.0-cu128` | 8188 | AI image-generation UI |
| `auth-server` | `./auth-server` (Node 20 Alpine) | 3001 | OTP generation, JWT issuance, token verification |
| `nginx` | `nginx:alpine` | 80 (mapped to `HOST_PORT`) | Reverse proxy, auth gate |

---

## Quick links

- [Setup guide](deployment.md)
- [API endpoints](api.md)
- [Environment variables](configuration.md)
