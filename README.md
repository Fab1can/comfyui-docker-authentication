# ComfyUI Docker Authentication

A Docker Compose stack that runs [ComfyUI](https://github.com/comfyanonymous/ComfyUI) behind an Nginx reverse proxy protected by JWT-based authentication.  
A lightweight Node.js auth server handles login via a rotating OTP and issues signed JWT tokens stored as HTTP-only cookies.

## Quick start

```bash
# 1. Clone and configure
git clone https://github.com/Fab1can/comfyui-docker-authentication.git
cd comfyui-docker-authentication
cp auth-server/.env.example auth-server/.env
# Set JWT_SECRET in auth-server/.env

# 2. Start
docker compose up -d

# 3. Get the OTP and log in
docker compose logs auth-server | grep OTP
curl -c cookies.txt "http://localhost:8188/auth/login?otp=<OTP>"

# 4. Open ComfyUI
open http://localhost:8188
```

## Prerequisites

- Docker ≥ 24 + Docker Compose ≥ 2
- NVIDIA Container Toolkit (GPU support)

## Documentation

Full documentation (English & Italiano) is available in the [`docs/`](docs/README.md) folder.
