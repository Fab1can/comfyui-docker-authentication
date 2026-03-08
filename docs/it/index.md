# ComfyUI Docker Authentication — Panoramica del progetto

ComfyUI Docker Authentication è un livello di sicurezza containerizzato che aggiunge **login tramite OTP e accesso protetto da JWT** a un'istanza di [ComfyUI](https://github.com/comfyanonymous/ComfyUI).  
Ogni richiesta HTTP (inclusi gli upgrade WebSocket) viene intercettata da Nginx, che esegue una sotto-richiesta di autenticazione verso un servizio Express.js leggero prima di instradare il traffico a ComfyUI.

---

## Indice della documentazione

| Documento | Descrizione |
|---|---|
| [Architettura](architecture.md) | Topologia dei servizi, flusso delle richieste, modello dei dati |
| [Auth Server](auth-server.md) | Analisi del codice sorgente di `auth-server/server.js` |
| [Nginx](nginx.md) | Configurazione del reverse proxy spiegata riga per riga |
| [Configurazione](configuration.md) | Tutte le variabili d'ambiente e i loro valori predefiniti |
| [API Reference](api.md) | Riferimento completo degli endpoint con esempi |
| [Deployment](deployment.md) | Guida passo passo alla configurazione e all'operatività |

---

## Servizi in sintesi

| Servizio | Immagine / Sorgente | Porta interna | Scopo |
|---|---|---|---|
| `comfyui` | `zeroclue/comfyui:ultra-slim-torch2.8.0-cu128` | 8188 | Interfaccia UI per la generazione di immagini AI |
| `auth-server` | `./auth-server` (Node 20 Alpine) | 3001 | Generazione OTP, emissione JWT, verifica token |
| `nginx` | `nginx:alpine` | 80 (mappato su `HOST_PORT`) | Reverse proxy, gateway di autenticazione |

---

## Link rapidi

- [Guida al setup](deployment.md)
- [Endpoint API](api.md)
- [Variabili d'ambiente](configuration.md)
