# Guida al deployment

## Prerequisiti

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) (necessario per il supporto GPU di ComfyUI)

---

## 1. Clona il repository

```bash
git clone https://github.com/Fab1can/comfyui-docker-authentication.git
cd comfyui-docker-authentication
```

---

## 2. Configura le variabili d'ambiente

Copia il file di esempio e modificalo secondo le tue esigenze:

```bash
cp auth-server/.env.example auth-server/.env
```

Come minimo, imposta un `JWT_SECRET` robusto:

```ini
# auth-server/.env
JWT_SECRET=sostituisci-con-un-segreto-casuale-lungo
```

Facoltativamente, cambia la porta host nel `.env` radice:

```ini
# .env
HOST_PORT=8188
```

---

## 3. Avvia lo stack

```bash
docker compose up -d
```

Tutti e tre i servizi (`comfyui`, `auth-server`, `nginx`) si avvieranno.  
Al primo avvio, Docker scaricherà le immagini e costruirà l'immagine dell'auth-server.

Verifica che tutti i container siano in salute:

```bash
docker compose ps
```

---

## 4. Ottieni l'OTP corrente

```bash
docker compose logs auth-server | grep -E "OTP"
```

L'OTP ruota ogni 30 secondi (configurabile). Copia il valore più recente.

---

## 5. Effettua il login

Apri un browser e naviga verso:

```
http://localhost:8188/auth/login?otp=<OTP>
```

Oppure usa `curl`:

```bash
curl -c cookies.txt "http://localhost:8188/auth/login?otp=<OTP>"
```

Una risposta positiva imposta il cookie HTTP-only `jwt`.

---

## 6. Apri ComfyUI

Naviga verso `http://localhost:8188` nel tuo browser.  
Il cookie viene inviato automaticamente e Nginx concede l'accesso a ComfyUI.

---

## Fermare lo stack

```bash
docker compose down
```

Per rimuovere anche il volume del workspace:

```bash
docker compose down -v
```

---

## Aggiornamento

```bash
docker compose pull          # aggiorna le immagini ComfyUI e Nginx
docker compose build         # ricostruisce l'immagine dell'auth-server
docker compose up -d
```

---

## Risoluzione dei problemi

### `401 Unauthorized` su ogni richiesta

- Verifica che il cookie `jwt` sia presente in DevTools del browser → Applicazione → Cookie.
- Controlla che `JWT_SECRET` sia lo stesso in `docker-compose.yml` e in qualsiasi file `.env`.
- Conferma che `auth-server` sia in esecuzione: `docker compose ps`.

### `502 Bad Gateway`

- ComfyUI potrebbe essere ancora in fase di caricamento dei modelli. Aspetta qualche secondo e ricarica.
- Controlla i log di ComfyUI: `docker compose logs comfyui`.

### OTP non visibile nei log

```bash
docker compose logs --tail=50 auth-server
```

Cerca righe come:
```
New OTP generated: 57312
```

### Il container non si avvia — errore GPU

Assicurati che NVIDIA Container Toolkit sia installato e che Docker sia configurato per usarlo:

```bash
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

### Rate limit attivo (`429 Too Many Requests`)

Attendi `LOCKOUT_DURATION` ms (default 10 minuti) prima di riprovare, oppure riavvia il container dell'auth-server per azzerare il contatore dei tentativi in memoria:

```bash
docker compose restart auth-server
```

---

## Raccomandazioni per la produzione

| Aspetto | Raccomandazione |
|---|---|
| **HTTPS** | Posiziona un reverse proxy con terminazione TLS (es. Traefik, Caddy) davanti a Nginx |
| **JWT_SECRET** | Usa una stringa casuale di ≥ 32 caratteri generata con `openssl rand -hex 32` |
| **JWT_EXPIRATION** | Riduci a `1d` o `8h` per ambienti sensibili |
| **Consegna OTP** | Usa uno strumento di aggregazione log o una pipeline di alerting per consegnare l'OTP in modo sicuro |
| **Gestione dei segreti** | Usa Docker secrets o un vault esterno invece di file `.env` in testo semplice |
