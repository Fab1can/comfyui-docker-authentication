# Riferimento alla configurazione

Tutta la configurazione viene fornita tramite variabili d'ambiente. La tabella seguente elenca ogni variabile, il file dove viene tipicamente impostata, il valore predefinito e il suo scopo.

---

## Ambiente root (`.env`)

| Variabile | Predefinito | Descrizione |
|---|---|---|
| `HOST_PORT` | `8188` | Porta dell'host mappata sulla porta 80 del container Nginx |

Impostata nel file `.env` radice e referenziata da `docker-compose.yml`:
```yaml
ports:
  - "${HOST_PORT}:80"
```

---

## Ambiente auth-server (`auth-server/.env` o `docker-compose.yml`)

| Variabile | Predefinito | Descrizione |
|---|---|---|
| `PORT` | `3001` | Porta su cui il server Express ascolta all'interno del container |
| `JWT_SECRET` | `change-this-secret-key` | Segreto HMAC usato per firmare e verificare i JWT. **Deve essere cambiato in produzione.** |
| `JWT_EXPIRATION` | `7d` | Durata del token. Accetta le stringhe di durata di `jsonwebtoken`: `30s`, `15m`, `2h`, `7d` |
| `OTP_REGENERATION_INTERVAL` | `30000` | Millisecondi tra una rotazione OTP e l'altra (default: 30 secondi) |
| `MAX_LOGIN_ATTEMPTS` | `5` | Numero massimo di tentativi di login falliti prima del blocco |
| `MAX_LOGIN_ATTEMPTS_TIME_WINDOW` | `600000` | Millisecondi in cui vengono contati i tentativi falliti (default: 10 minuti) |
| `LOCKOUT_DURATION` | `600000` | Millisecondi per cui un IP rimane bloccato dopo aver superato il limite di tentativi (default: 10 minuti) |
| `COMFYUI_HOST` | `http://comfyui:8188` | Indirizzo interno del servizio ComfyUI (informativo, non usato direttamente in server.js) |
| `NODE_ENV` | — | Impostato a `production` in `docker-compose.yml`; abilita il flag `secure` sul cookie JWT |

---

## Impostare i segreti in modo sicuro

### Opzione 1 — File `.env` radice (consigliato per uso locale)

```ini
# .env  (ignorato da git per impostazione predefinita)
HOST_PORT=8188
JWT_SECRET=una-stringa-casuale-molto-lunga-di-almeno-32-caratteri
```

### Opzione 2 — Inline in `docker-compose.yml`

```yaml
auth-server:
  environment:
    - JWT_SECRET=una-stringa-casuale-molto-lunga-di-almeno-32-caratteri
    - JWT_EXPIRATION=1d
```

### Opzione 3 — Docker secrets (produzione / Swarm)

Per i deployment in produzione, usare Docker secrets o un secrets manager invece di variabili in testo semplice.

---

## Formato della scadenza JWT

La variabile `JWT_EXPIRATION` usa il formato della libreria `jsonwebtoken`:

| Valore | Significato |
|---|---|
| `60` | 60 secondi |
| `15m` | 15 minuti |
| `2h` | 2 ore |
| `7d` | 7 giorni (default) |
| `30d` | 30 giorni |

---

## Tuning del rate limiting

I valori predefiniti consentono **5 tentativi falliti** in qualsiasi **finestra di 10 minuti** prima di bloccare quell'IP per **10 minuti**:

```
MAX_LOGIN_ATTEMPTS=5
MAX_LOGIN_ATTEMPTS_TIME_WINDOW=600000   # 10 min in ms
LOCKOUT_DURATION=600000                 # 10 min in ms
```

Per aumentare la sicurezza (es. solo 3 tentativi, blocco di 30 minuti):

```ini
MAX_LOGIN_ATTEMPTS=3
LOCKOUT_DURATION=1800000
```
