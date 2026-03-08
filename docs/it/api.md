# API Reference

Tutti gli endpoint sono esposti tramite Nginx su `http://<host>:HOST_PORT/auth/`.  
L'auth-server ascolta internamente sulla porta 3001.

---

## Panoramica degli endpoint

| Metodo | Percorso | Auth | Descrizione |
|---|---|---|---|
| `GET` | `/auth/login` | Nessuna | Scambia OTP per cookie JWT |
| `GET` | `/auth/logout` | Bearer token | Revoca il token e cancella il cookie |
| `GET` | `/auth/verify` | Bearer token | Valida il token (usato internamente da Nginx) |
| `GET` | `/auth/refresh` | Bearer token | Ruota il token |
| `GET` | `/auth/health` | Nessuna | Controllo di salute del servizio |

---

## `GET /auth/login`

Autenticazione con l'OTP corrente e ricezione di un JWT salvato come cookie HTTP-only.

### Parametri query

| Nome | Obbligatorio | Descrizione |
|---|---|---|
| `otp` | Sì | OTP a 5 cifre corrente (letto dai log del container) |

### Risposta di successo — `200 OK`

```json
{ "message": "Login successful" }
```

La risposta imposta anche:

```
Set-Cookie: jwt=<TOKEN>; Path=/; HttpOnly; SameSite=Strict; Max-Age=<secondi>
```

### Risposte di errore

| Stato | Condizione |
|---|---|
| `401 Unauthorized` | L'OTP non è corretto |
| `429 Too Many Requests` | L'IP ha superato `MAX_LOGIN_ATTEMPTS` |

### Esempio

```bash
curl -c cookies.txt \
  "http://localhost:8188/auth/login?otp=47391"
```

---

## `GET /auth/logout`

Revoca il token corrente e cancella il cookie.

### Header

```
Authorization: Bearer <token>
```

### Risposta di successo — `200 OK`

```json
{ "message": "Logged out successfully" }
```

La risposta imposta anche:

```
Set-Cookie: jwt=; Max-Age=0
```

### Risposte di errore

| Stato | Condizione |
|---|---|
| `401 Unauthorized` | Nessun token fornito, o token non valido / scaduto |

### Esempio

```bash
curl -b cookies.txt \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8188/auth/logout"
```

---

## `GET /auth/verify`

Verifica se un token è valido e non è stato revocato.  
Questo endpoint viene chiamato dalla direttiva `auth_request` di Nginx per ogni richiesta protetta; di norma non viene chiamato direttamente dai client.

### Header

```
Authorization: Bearer <token>
```

### Risposta di successo — `200 OK`

```json
{ "valid": true, "token": "<token>" }
```

### Risposte di errore

| Stato | Condizione |
|---|---|
| `401 Unauthorized` | Token mancante, non valido, scaduto o revocato |

---

## `GET /auth/refresh`

Emette un nuovo token in cambio di un token valido esistente.  
Il vecchio token viene revocato e il nuovo viene impostato come cookie.

### Header

```
Authorization: Bearer <token>
```

### Risposta di successo — `200 OK`

```json
{ "message": "Token refreshed", "token": "<new_token>" }
```

La risposta imposta anche un nuovo cookie `jwt`.

### Risposte di errore

| Stato | Condizione |
|---|---|
| `401 Unauthorized` | Token mancante, non valido o scaduto |

### Esempio

```bash
curl -b cookies.txt -c cookies.txt \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8188/auth/refresh"
```

---

## `GET /auth/health`

Restituisce lo stato del servizio. Nessuna autenticazione richiesta.

### Risposta di successo — `200 OK`

```json
{ "status": "ok" }
```

### Esempio

```bash
curl "http://localhost:8188/auth/health"
```

---

## Utilizzo del JWT nelle richieste

Una volta effettuato il login, il cookie `jwt` viene inviato automaticamente dal browser ad ogni richiesta.  
Per i client programmatici che non possono usare i cookie, passare il token come header `Bearer`:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8188/"
```

> Nginx estrae il valore del cookie e lo inoltra come header `Bearer` sia all'auth-server (`/_auth_request`) che a ComfyUI (`/`).
