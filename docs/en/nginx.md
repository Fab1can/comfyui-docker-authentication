# Nginx Configuration

Source file: `nginx/default.conf`  
Image: `nginx:alpine`

---

## Complete annotated configuration

```nginx
server {
    listen 80;
    server_name localhost;
```

Nginx listens on port 80 inside the container.  
Docker Compose maps this to `HOST_PORT` on the host.

---

### `/auth/` — public authentication routes

```nginx
    location /auth/ {
        auth_request off;

        proxy_pass         http://auth-server:3001/;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
```

`auth_request off` explicitly disables the JWT check for this prefix, so unauthenticated clients can reach the login endpoint.  
Requests to `/auth/login`, `/auth/logout`, etc. are proxied to port 3001 of the `auth-server` container.

---

### `/auth/health` — health probe

```nginx
    location /auth/health {
        proxy_pass       http://auth-server:3001/health;
        access_log       off;
    }
```

A dedicated block for the health endpoint with logging suppressed to avoid noise.

---

### `/_auth_request` — internal JWT validation

```nginx
    location = /_auth_request {
        internal;

        proxy_pass              http://auth-server:3001/verify;
        proxy_pass_request_body off;
        proxy_set_header        Content-Length   "";
        proxy_set_header        Authorization    "Bearer $cookie_jwt";
    }
```

`internal` prevents clients from calling this location directly (returns 404 if requested externally).  
`proxy_pass_request_body off` and `Content-Length ""` avoid sending the original request body to the auth-server, which only needs to verify the token.  
`Authorization "Bearer $cookie_jwt"` translates the `jwt` HTTP-only cookie into the `Authorization` header expected by `verifyToken` middleware.

---

### `/` — protected ComfyUI reverse proxy

```nginx
    location / {
        auth_request /_auth_request;

        proxy_pass         http://comfyui:8188;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   Authorization     "Bearer $cookie_jwt";

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

`auth_request /_auth_request` fires a sub-request before passing traffic to ComfyUI:
- Sub-request returns **2xx** → Nginx continues to proxy the original request
- Sub-request returns **4xx/5xx** → Nginx returns the same status code to the client (401 by default)

**WebSocket handling**:
- `proxy_http_version 1.1` is required for the `Upgrade` handshake
- `proxy_set_header Upgrade $http_upgrade` forwards the `Upgrade: websocket` header
- `proxy_set_header Connection "upgrade"` keeps the connection persistent
- `proxy_read_timeout 86400` sets a 24-hour read timeout, preventing Nginx from closing long-lived WebSocket connections

---

## Request routing table

| Path pattern | Auth required | Upstream |
|---|---|---|
| `/auth/*` | No | `auth-server:3001` |
| `/auth/health` | No | `auth-server:3001/health` |
| `/_auth_request` | Internal only | `auth-server:3001/verify` |
| `/*` (everything else) | **Yes** (JWT cookie) | `comfyui:8188` |

---

## Security considerations

- The `/_auth_request` location is `internal`, so it is not reachable from the internet.
- The JWT cookie is `httpOnly` and `sameSite=strict`, limiting CSRF and XSS exposure.
- All auth validation logic lives in the `auth-server`; Nginx only acts as a gate.
- If `auth-server` becomes unavailable, all requests to ComfyUI will return 500 (fail-closed behaviour).
