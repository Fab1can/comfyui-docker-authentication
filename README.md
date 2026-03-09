# ComfyUI Docker Authentication

A Docker Compose stack that runs [ComfyUI](https://github.com/comfyanonymous/ComfyUI) behind an Nginx reverse proxy protected by JWT-based authentication. A lightweight Node.js auth server handles login via a rotating OTP (One-Time Password) and issues signed JWT tokens stored as HTTP-only cookies.

## Architecture

| Service | Image / Source | Description |
|---|---|---|
| `comfyui` | `zeroclue/comfyui:ultra-slim-torch2.8.0-cu128` | ComfyUI with NVIDIA GPU support |
| `auth-server` | `./auth-server` (Node.js/Express) | Issues and validates JWT tokens; OTP-based login |
| `nginx` | `nginx:alpine` | Reverse proxy; enforces JWT authentication via `auth_request` |

### Authentication flow

1. The auth-server prints a 5-digit OTP to its logs on startup and regenerates it every 30 seconds (configurable).
2. A client calls `GET /auth/login?otp=<OTP>` to obtain a JWT token, which is stored as an HTTP-only cookie.
3. Nginx validates every request to ComfyUI by forwarding the cookie to `/_auth_request` (backed by `GET /auth/verify`).
4. Tokens can be refreshed with `GET /auth/refresh` and invalidated with `GET /auth/logout`.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) (required for GPU support)

## Setup & Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/Fab1can/comfyui-docker-authentication.git
    cd comfyui-docker-authentication
    ```

2. **Configure environment variables**

    Copy the auth-server example file and set at minimum `JWT_SECRET`:

    ```bash
    cp auth-server/.env.example auth-server/.env
    # Edit auth-server/.env and set JWT_SECRET to a strong random value
    ```

    The root `.env` file controls the host port Nginx listens on (default `8188`):

    ```bash
    # .env
    HOST_PORT=8188
    ```

3. **Start the stack**

    ```bash
    docker compose up -d
    ```

4. **Get the OTP**

    Read the OTP from the auth-server logs:

    ```bash
    docker compose logs auth-server
    ```

    Look for a line like:
    ```
    2026-03-06T09:00:00.000Z: OTP generated: 47291
    ```

5. **Log in**

    ```bash
    curl -c cookies.txt "http://localhost:8188/auth/login?otp=47291"
    ```

    On success you will receive `{"success":true,"token":"..."}` and a `jwt` cookie is set.

6. **Open ComfyUI**

    Navigate to `http://localhost:8188` in a browser that holds the `jwt` cookie (e.g., after logging in via the browser directly at `http://localhost:8188/auth/login?otp=<OTP>`).

## Environment Variables

### Root `.env`

| Variable | Default | Description |
|---|---|---|
| `HOST_PORT` | `8188` | Host port mapped to Nginx |

### `auth-server/.env`

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Auth-server listen port |
| `JWT_SECRET` | `change-this-secret-key` | Secret used to sign JWT tokens — **must be changed** |
| `JWT_EXPIRATION` | `7d` | Token lifetime (e.g. `7d`, `12h`, `30m`) |
| `OTP_REGENERATION_INTERVAL` | `30000` | OTP rotation interval in milliseconds |
| `MAX_LOGIN_ATTEMPTS` | `5` | Max failed login attempts before rate-limiting |
| `MAX_LOGIN_ATTEMPTS_TIME_WINDOW` | `600000` | Time window (ms) for counting failed attempts |
| `LOCKOUT_DURATION` | `600000` | Lockout duration in milliseconds (currently informational) |

## Auth Server Endpoints

All auth endpoints are available under the `/auth/` prefix through Nginx.

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/auth/login?otp=<OTP>` | No | Exchange a valid OTP for a JWT cookie |
| `GET` | `/auth/logout` | Yes (Bearer) | Invalidate the current token |
| `GET` | `/auth/verify` | Yes (Bearer) | Verify the current token |
| `GET` | `/auth/refresh` | Yes (Bearer) | Rotate the current token |
| `GET` | `/auth/health` | No | Health check |

## Workspace

ComfyUI data (models, outputs, etc.) is persisted in the `./workspace` directory, which is mounted into the container at `/workspace`.

## Troubleshooting

- **401 on every request**: Make sure you have logged in and that the `jwt` cookie is present in your browser.
- **OTP expired**: OTPs rotate every `OTP_REGENERATION_INTERVAL` ms (default 30 s). Check the auth-server logs for the latest OTP.
- **Too many login attempts (429)**: Wait for the lockout window to expire (default 10 minutes).
- **GPU not found**: Ensure the NVIDIA Container Toolkit is installed and configured on the host machine.

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.

[![CC BY-NC-SA 4.0](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
