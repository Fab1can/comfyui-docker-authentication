# Auth Server — Code Documentation

Source file: `auth-server/server.js`  
Runtime: Node.js 20 (Alpine)  
Framework: Express 4

---

## Dependencies

| Package | Version | Role |
|---|---|---|
| `express` | ^4.18.2 | HTTP framework |
| `jsonwebtoken` | ^9.0.3 | JWT sign / verify |
| `cors` | ^2.8.5 | CORS headers |
| `dotenv` | ^16.3.1 | `.env` loading |
| `cookie-parser` | ^1.4.6 | Cookie parsing middleware |

---

## Configuration constants

These values are read from environment variables at startup (see [Configuration](configuration.md)):

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

## In-memory state

```js
let currentOtp    = generateOtp()        // active 5-digit OTP string
let validTokens   = []                   // list of currently valid JWTs
const loginAttempts = {}                 // keyed by IP address
```

> **Note**: `validTokens` and `loginAttempts` are reset on container restart.  
> There is intentionally no persistence layer so compromised tokens are automatically cleared on redeploy.

---

## OTP generation

```js
function generateOtp() {
    return Math.floor(10000 + Math.random() * 90000).toString()
}
```

Produces a uniformly distributed 5-digit string (`"10000"` – `"99999"`).  
A `setInterval` call at startup rotates the OTP every `OTP_REGENERATION_INTERVAL` ms and logs it:

```js
setInterval(() => {
    currentOtp = generateOtp()
    console.log(`New OTP generated: ${currentOtp}`)
}, OTP_REGENERATION_INTERVAL)
```

---

## Middleware stack

```js
app.use(cors())
app.use(express.json())
app.use(cookieParser())
```

`cors()` is used without a whitelist, allowing all origins.  
`cookieParser()` makes `req.cookies` available for JWT extraction.

---

## `verifyToken` middleware

Used on `/logout`, `/verify`, and `/refresh`.

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

Tokens are extracted exclusively from the `Authorization: Bearer <token>` header.  
The cookie is only used by Nginx, which translates it to a header via:
```nginx
proxy_set_header Authorization "Bearer $cookie_jwt";
```

---

## Routes

### `GET /login`

**Purpose**: Exchange a valid OTP for a JWT cookie.

**Query parameters**: `otp` (required)

**Rate-limiting logic**:

```js
const attempts = loginAttempts[ip] || { count: 0, firstAttempt: Date.now(), lockedUntil: 0 }

if (Date.now() < attempts.lockedUntil) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
}
// reset window if expired
if (Date.now() - attempts.firstAttempt > MAX_LOGIN_ATTEMPTS_TIME_WINDOW) {
    attempts.count = 0
    attempts.firstAttempt = Date.now()
}
// increment and lock if threshold exceeded
attempts.count++
if (attempts.count > MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
}
loginAttempts[ip] = attempts
```

**Token issuance** (only on correct OTP):

```js
const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: JWT_EXPIRATION })
validTokens.push(token)

// parse expiration to milliseconds for cookie maxAge
const expirationMatch = JWT_EXPIRATION.match(/^(\d+)([smhd])$/)
// ... conversion logic ...

res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAge,
    sameSite: 'strict'
})
return res.json({ message: 'Login successful' })
```

HTTP-only cookies prevent JavaScript access to the token from the browser.

---

### `GET /logout`

**Auth**: `verifyToken` middleware (Bearer token required)

**Behaviour**:
- Removes the token from `validTokens`
- Clears the `jwt` cookie

```js
validTokens = validTokens.filter(t => t !== req.token)
res.clearCookie('jwt')
return res.json({ message: 'Logged out successfully' })
```

---

### `GET /verify`

**Auth**: `verifyToken` middleware

**Purpose**: Used internally by Nginx's `auth_request` sub-request.

```js
if (!validTokens.includes(req.token)) {
    return res.status(401).json({ error: 'Token not found or already revoked' })
}
return res.json({ valid: true, token: req.token })
```

Returns `401` if the token has been explicitly revoked (even if the JWT signature is still valid).

---

### `GET /refresh`

**Auth**: `verifyToken` middleware

**Behaviour**:
- Signs a new JWT
- Removes the old token from `validTokens`
- Stores the new token and issues a fresh cookie

```js
const newToken = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: JWT_EXPIRATION })
validTokens = validTokens.filter(t => t !== req.token)
validTokens.push(newToken)
// ... set cookie ...
return res.json({ message: 'Token refreshed', token: newToken })
```

---

### `GET /health`

No authentication required.  
Returns `{ status: 'ok' }` with HTTP 200.  
Used by Docker's `HEALTHCHECK` instruction.

---

## Docker container

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

The image installs only production dependencies (no `devDependencies`) and copies only `server.js`.
