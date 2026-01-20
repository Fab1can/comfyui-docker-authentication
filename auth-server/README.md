# ComfyUI JWT Authentication System

## Overview

Questo sistema sostituisce la Basic Auth di Nginx con un'autenticazione basata su JWT (JSON Web Token) usando Express.js.

## Architettura

```
Client → Nginx (port 8188) → Auth Server (Express.js) + ComfyUI
```

### Componenti

1. **Auth Server** (Express.js): Gestisce login/logout e token JWT
2. **Nginx**: Proxy inverso che valida i token JWT
3. **ComfyUI**: Backend protetto da autenticazione

## API Endpoints

### Autenticazione

#### POST /api/auth/login
Login e ricevi JWT token
```bash
curl -X POST http://localhost:8188/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "user"
  }
}
```

#### POST /api/auth/logout
Logout (richiede token)
```bash
curl -X POST http://localhost:8188/api/auth/logout \
  -H "Authorization: Bearer <TOKEN>"
```

#### GET /api/auth/verify
Verifica validità del token
```bash
curl http://localhost:8188/api/auth/verify \
  -H "Authorization: Bearer <TOKEN>"
```

#### POST /api/auth/refresh
Rinnova il token JWT
```bash
curl -X POST http://localhost:8188/api/auth/refresh \
  -H "Authorization: Bearer <TOKEN>"
```

#### GET /api/auth/health
Health check (no auth required)

## Uso dei Token

### Nei Header HTTP
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Nel Client JavaScript
```javascript
const auth = new ComfyUIAuthClient();

// Login
await auth.login('username', 'password');

// Fare richieste autenticate
const response = await auth.apiRequest('/api/prompt', {
  method: 'POST',
  body: JSON.stringify({ /* workflow */ })
});
```

## Configurazione

### .env
```env
PORT=3001                        # Porta auth server
JWT_SECRET=your-secret-key       # Secret key per firmare token (generato automaticamente)
JWT_EXPIRATION=7d               # Scadenza token
COMFYUI_HOST=http://comfyui:8188
NODE_ENV=production
```

### Generazione JWT_SECRET

Il file `init_auth.sh` genera automaticamente un JWT_SECRET random e lo salva in `.env`.

## Setup

1. Esegui lo script di inizializzazione:
```bash
chmod +x init_auth.sh
./init_auth.sh
```

2. Avvia i servizi:
```bash
docker compose up -d
```

3. Verifica che il sistema sia online:
```bash
curl http://localhost:8188/api/auth/health
```

## Implementare Autenticazione Custom

Nel file `auth-server/server.js`, modifica il route `POST /login`:

```javascript
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // TODO: Sostituisci con la tua logica di autenticazione
  // Esempio: query database, verifica file, LDAP, OAuth, etc.
  
  const isValid = checkCredentials(username, password);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = { id: 1, username: username };
  const token = generateToken(user);

  res.json({
    success: true,
    token: token,
    user: user
  });
});
```

## Migrazione da Basic Auth

Se eri su un sistema con Basic Auth:

1. Il nuovo sistema non usa `.htpasswd`
2. Rimuovi lo script `renew_user.sh` (obsoleto)
3. Implementa la tua logica di autenticazione in `auth-server/server.js`

## WebSocket

L'autenticazione JWT funziona anche con WebSocket grazie a Nginx che valida i token nei header `Authorization`.

## Sicurezza

- Cambia `JWT_SECRET` in produzione (generato automaticamente)
- Usa HTTPS/TLS in produzione
- Imposta token expiration appropriato (default: 7d)
- Implementa rate limiting nel route `/login`

## Troubleshooting

### 401 Unauthorized
- Token mancante o scaduto
- Usa il formato `Authorization: Bearer <TOKEN>`

### CORS errors
- L'auth server ha CORS abilitato per permettere richieste cross-origin

### Token invalido
- Verifica che JWT_SECRET sia lo stesso tra auth-server e nginx
- Controlla che il token non sia scaduto

## File Modificati

- `docker-compose.yml` - Aggiunto servizio auth-server
- `nginx/default.conf` - Aggiunto proxy per auth-server e validazione JWT
- `check_initialized.sh` - Obsoleto (non più necessario)
- `renew_user.sh` - Obsoleto (non più necessario)
