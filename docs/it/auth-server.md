# Auth Server — Documentazione del codice

File sorgente: `auth-server/server.js`  
Runtime: Node.js 20 (Alpine)  
Framework: Express 4

---

## Dipendenze

| Pacchetto | Versione | Ruolo |
|---|---|---|
| `express` | ^4.18.2 | Framework HTTP |
| `jsonwebtoken` | ^9.0.3 | Firma e verifica dei JWT |
| `cors` | ^2.8.5 | Header CORS |
| `dotenv` | ^16.3.1 | Caricamento file `.env` |
| `cookie-parser` | ^1.4.6 | Middleware di parsing dei cookie |

---

## Costanti di configurazione

Questi valori vengono letti dalle variabili d'ambiente all'avvio (vedi [Configurazione](configuration.md)):

```js
const PORT                       = process.env.PORT                       || 3001
const JWT_SECRET                 = process.env.JWT_SECRET                 || 'change-this-secret-key'
const JWT_EXPIRATION             = process.env.JWT_EXPIRATION             || '7d'
const OTP_REGENERATION_INTERVAL  = process.env.OTP_REGENERATION_INTERVAL  || 30000
const MAX_LOGIN_ATTEMPTS         = process.env.MAX_LOGIN_ATTEMPTS         || 5
const MAX_LOGIN_ATTEMPTS_TIME_WINDOW = process.env.MAX_LOGIN_ATTEMPTS_TIME_WINDOW || 600000
const LOCKOUT_DURATION           = process.env.LOCKOUT_DURATION           || 600000
```

---

## Stato in memoria

```js
let currentOtp    = generateOtp()        // OTP a 5 cifre attivo
let validTokens   = []                   // lista dei JWT attualmente validi
const loginAttempts = {}                 // indicizzato per indirizzo IP
```

> **Nota**: `validTokens` e `loginAttempts` vengono azzerati al riavvio del container.  
> Non esiste un livello di persistenza intenzionalmente, così i token compromessi vengono eliminati automaticamente al rideploy.

---

## Generazione OTP

```js
function generateOtp() {
    return Math.floor(10000 + Math.random() * 90000).toString()
}
```

Produce una stringa a 5 cifre distribuita uniformemente (`"10000"` – `"99999"`).  
Una chiamata `setInterval` all'avvio ruota l'OTP ogni `OTP_REGENERATION_INTERVAL` ms e lo registra nel log:

```js
setInterval(() => {
    currentOtp = generateOtp()
    console.log(`New OTP generated: ${currentOtp}`)
}, OTP_REGENERATION_INTERVAL)
```

---

## Stack middleware

```js
app.use(cors())
app.use(express.json())
app.use(cookieParser())
```

`cors()` è usato senza lista bianca, consentendo tutte le origini.  
`cookieParser()` rende disponibile `req.cookies` per l'estrazione del JWT.

---

## Middleware `verifyToken`

Utilizzato sulle route `/logout`, `/verify` e `/refresh`.

```js
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]   // "Bearer <token>"

    if (!token) return res.status(401).json({ error: 'No token provided' })

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        req.token = token
        next()
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' })
    }
}
```

I token vengono estratti esclusivamente dall'header `Authorization: Bearer <token>`.  
Il cookie viene usato solo da Nginx, che lo traduce in header tramite:
```nginx
proxy_set_header Authorization "Bearer $cookie_jwt";
```

---

## Route

### `GET /login`

**Scopo**: Scambiare un OTP valido per un cookie JWT.

**Parametri query**: `otp` (obbligatorio)

**Logica di rate-limiting**:

```js
const attempts = loginAttempts[ip] || { count: 0, firstAttempt: Date.now(), lockedUntil: 0 }

if (Date.now() < attempts.lockedUntil) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
}
// reset finestra se scaduta
if (Date.now() - attempts.firstAttempt > MAX_LOGIN_ATTEMPTS_TIME_WINDOW) {
    attempts.count = 0
    attempts.firstAttempt = Date.now()
}
// incrementa e blocca se supera la soglia
attempts.count++
if (attempts.count > MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
}
loginAttempts[ip] = attempts
```

**Emissione del token** (solo con OTP corretto):

```js
const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: JWT_EXPIRATION })
validTokens.push(token)

// conversione della scadenza in millisecondi per cookie maxAge
const expirationMatch = JWT_EXPIRATION.match(/^(\d+)([smhd])$/)
// ... logica di conversione ...

res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAge,
    sameSite: 'strict'
})
return res.json({ message: 'Login successful' })
```

I cookie HTTP-only impediscono l'accesso JavaScript al token dal browser.

---

### `GET /logout`

**Auth**: middleware `verifyToken` (token Bearer obbligatorio)

**Comportamento**:
- Rimuove il token da `validTokens`
- Cancella il cookie `jwt`

```js
validTokens = validTokens.filter(t => t !== req.token)
res.clearCookie('jwt')
return res.json({ message: 'Logged out successfully' })
```

---

### `GET /verify`

**Auth**: middleware `verifyToken`

**Scopo**: Utilizzato internamente dalla sotto-richiesta `auth_request` di Nginx.

```js
if (!validTokens.includes(req.token)) {
    return res.status(401).json({ error: 'Token not found or already revoked' })
}
return res.json({ valid: true, token: req.token })
```

Restituisce `401` se il token è stato esplicitamente revocato (anche se la firma JWT è ancora valida).

---

### `GET /refresh`

**Auth**: middleware `verifyToken`

**Comportamento**:
- Firma un nuovo JWT
- Rimuove il vecchio token da `validTokens`
- Salva il nuovo token e imposta un cookie aggiornato

```js
const newToken = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: JWT_EXPIRATION })
validTokens = validTokens.filter(t => t !== req.token)
validTokens.push(newToken)
// ... imposta cookie ...
return res.json({ message: 'Token refreshed', token: newToken })
```

---

### `GET /health`

Nessuna autenticazione richiesta.  
Restituisce `{ status: 'ok' }` con HTTP 200.  
Utilizzato dall'istruzione `HEALTHCHECK` di Docker.

---

## Container Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm i
COPY server.js .
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { \
      if (r.statusCode !== 200) throw new Error(r.statusCode)})"
CMD ["node", "server.js"]
```

L'immagine installa solo le dipendenze di produzione (senza `devDependencies`) e copia solo `server.js`.
