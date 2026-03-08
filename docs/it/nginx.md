# Configurazione Nginx

File sorgente: `nginx/default.conf`  
Immagine: `nginx:alpine`

---

## Configurazione completa commentata

```nginx
server {
    listen 80;
    server_name localhost;
```

Nginx ascolta sulla porta 80 all'interno del container.  
Docker Compose mappa questa porta su `HOST_PORT` sull'host.

---

### `/auth/` — route di autenticazione pubbliche

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

`auth_request off` disabilita esplicitamente il controllo JWT per questo prefisso, in modo che i client non autenticati possano raggiungere l'endpoint di login.  
Le richieste a `/auth/login`, `/auth/logout`, ecc. vengono instradate verso la porta 3001 del container `auth-server`.

---

### `/auth/health` — probe di salute

```nginx
    location /auth/health {
        proxy_pass       http://auth-server:3001/health;
        access_log       off;
    }
```

Blocco dedicato all'endpoint di health con il logging disabilitato per evitare rumore nei log.

---

### `/_auth_request` — validazione JWT interna

```nginx
    location = /_auth_request {
        internal;

        proxy_pass              http://auth-server:3001/verify;
        proxy_pass_request_body off;
        proxy_set_header        Content-Length   "";
        proxy_set_header        Authorization    "Bearer $cookie_jwt";
    }
```

`internal` impedisce ai client di chiamare direttamente questa location (restituisce 404 se richiesta dall'esterno).  
`proxy_pass_request_body off` e `Content-Length ""` evitano di inviare il corpo della richiesta originale all'auth-server, che deve solo verificare il token.  
`Authorization "Bearer $cookie_jwt"` traduce il cookie HTTP-only `jwt` nell'header `Authorization` atteso dal middleware `verifyToken`.

---

### `/` — reverse proxy ComfyUI protetto

```nginx
    location / {
        auth_request /_auth_request;

        proxy_pass         http://comfyui:8188;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   Authorization     "Bearer $cookie_jwt";

        # Supporto WebSocket
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

`auth_request /_auth_request` esegue una sotto-richiesta prima di passare il traffico a ComfyUI:
- La sotto-richiesta restituisce **2xx** → Nginx procede con il proxy della richiesta originale
- La sotto-richiesta restituisce **4xx/5xx** → Nginx restituisce lo stesso codice di stato al client (401 di default)

**Gestione WebSocket**:
- `proxy_http_version 1.1` è necessario per l'handshake `Upgrade`
- `proxy_set_header Upgrade $http_upgrade` inoltra l'header `Upgrade: websocket`
- `proxy_set_header Connection "upgrade"` mantiene la connessione persistente
- `proxy_read_timeout 86400` imposta un timeout di lettura di 24 ore, evitando che Nginx chiuda le connessioni WebSocket di lunga durata

---

## Tabella di routing delle richieste

| Pattern percorso | Auth richiesta | Upstream |
|---|---|---|
| `/auth/*` | No | `auth-server:3001` |
| `/auth/health` | No | `auth-server:3001/health` |
| `/_auth_request` | Solo interno | `auth-server:3001/verify` |
| `/*` (tutto il resto) | **Sì** (cookie JWT) | `comfyui:8188` |

---

## Considerazioni sulla sicurezza

- La location `/_auth_request` è `internal`, quindi non raggiungibile da Internet.
- Il cookie JWT è `httpOnly` e `sameSite=strict`, limitando l'esposizione a CSRF e XSS.
- Tutta la logica di validazione dell'autenticazione risiede nell'`auth-server`; Nginx agisce solo come cancello.
- Se l'`auth-server` diventa non disponibile, tutte le richieste a ComfyUI restituiranno 500 (comportamento fail-closed).
