# Architettura

## Topologia dei servizi

```
┌──────────────────────────────────────────────┐
│                   Client                     │
│              (browser / API)                 │
└───────────────────────┬──────────────────────┘
                        │ :HOST_PORT (default 8188)
                        ▼
┌──────────────────────────────────────────────┐
│              Nginx  (porta 80)               │
│                                              │
│  /auth/*  ─────────────────► auth-server     │
│  /        ─── auth_request ► auth-server     │
│           └── (se valido)  ► comfyui         │
└──────────────────────────────────────────────┘
          │                           │
          ▼ :3001                     ▼ :8188 (interno)
┌─────────────────┐        ┌──────────────────────┐
│   auth-server   │        │       comfyui         │
│  (Node.js 20)   │        │  (PyTorch + NVIDIA)   │
└─────────────────┘        └──────────────────────┘
```

---

## Flusso di autenticazione

```
Client                  Nginx                auth-server          ComfyUI
  │                       │                      │                   │
  │  GET /auth/login       │                      │                   │
  │   ?otp=<OTP>          │                      │                   │
  │ ─────────────────────►│                      │                   │
  │                       │  proxy /login?otp=…  │                   │
  │                       │ ────────────────────►│                   │
  │                       │    200 + Set-Cookie  │                   │
  │                       │◄────────────────────  │                   │
  │◄──────────────────────│                      │                   │
  │  Cookie: jwt=<TOKEN>   │                      │                   │
  │                       │                      │                   │
  │  GET /                │                      │                   │
  │ (cookie inviato)      │                      │                   │
  │ ─────────────────────►│                      │                   │
  │                       │  sotto-richiesta     │                   │
  │                       │  GET /_auth_request  │                   │
  │                       │ ────────────────────►│                   │
  │                       │       200 OK         │                   │
  │                       │◄────────────────────  │                   │
  │                       │  proxy a ComfyUI     │                   │
  │                       │ ────────────────────────────────────────►│
  │                       │                      │     200 OK        │
  │◄─────────────────────────────────────────────────────────────────│
```

### Rotazione OTP

L'auth-server genera un **OTP casuale a 5 cifre** all'avvio e lo rigenera ogni `OTP_REGENERATION_INTERVAL` millisecondi (default 30 s).  
L'OTP corrente viene stampato nel log del container:

```
docker compose logs auth-server | grep "Current OTP"
```

---

## Ciclo di vita del token

```
[login con OTP]
       │
       ▼
  JWT creato  ──── salvato in memoria (validTokens[])
       │              ──── inviato come cookie HTTP-only
       │
  [/verify chiamato dalla auth_request di Nginx]
       │
       ▼
  token in validTokens? ─── sì ──► 200 OK
                        └─── no ──► 401 Unauthorized
       │
  [/refresh]
       │
       ▼
  vecchio token rimosso, nuovo token emesso e salvato
       │
  [/logout]
       │
       ▼
  token rimosso da validTokens[], cookie cancellato
```

---

## Persistenza dei dati

Il workspace di ComfyUI (modelli, output, workflow) viene persistito tramite un bind-mount:

```yaml
volumes:
  - ./workspace:/workspace
```

L'auth-server mantiene la lista dei token validi **solo in memoria**; viene azzerata ogni volta che il container viene riavviato.

---

## Rete

Tutti i servizi comunicano sulla rete bridge predefinita del progetto Docker Compose.  
L'unica porta esposta esternamente è quella di Nginx (`HOST_PORT`).  
`comfyui` e `auth-server` non sono raggiungibili direttamente dall'host.
