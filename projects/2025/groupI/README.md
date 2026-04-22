# 🌱 Smart-Plant-Care

**Smart-Plant-Care** è un'applicazione basata sullo standard **Web of Things (WoT)** del W3C per il monitoraggio e la gestione automatizzata (simulata) di una serra o di una pianta domestica.

Il progetto utilizza la libreria `@node-wot/core` per creare dispositivi virtuali (sensori e attuatori) e offre un'interfaccia web moderna costruita con Tailwind CSS per monitorare lo stato in tempo reale e inviare comandi.

---

## Funzionamento del Sistema

Il sistema non si collega (per il momento) a sensori fisici reali, ma si affida a un **motore di simulazione temporale**. 
L'umidità del terreno e la luminosità reagiscono in modo realistico alle azioni dell'utente:
- Se l'utente accende la **Pompa dell'acqua** dall'interfaccia web, l'umidità sale progressivamente. Se la spegne, dopo 15 secondi di "inerzia" il terreno inizia ad asciugarsi.
- Se l'utente accende la **Lampada Smart**, la luminosità in Lux aumenta. Se la spegne, torna gradualmente al livello ambientale base.

Tutta la comunicazione tra la dashboard web (il Client) e i dispositivi (i Server) avviene in HTTP scaricando e interpretando le **Thing Description (TD)**.

---

## Struttura del Progetto

L'architettura è divisa in script backend (dispositivi WoT) e frontend (Dashboard UI).

### Backend & Dispositivi IoT (Node.js)
- **`sensors.js` (Porta 8081)**: Espone i sensori `SoilMoistureSensor` (Umidità) e `LightSensor` (Luce). Contiene la logica matematica di simulazione temporale e di decadimento dei valori.
- **`actuators.js` (Porta 8082)**: Espone gli attuatori `IrrigationSystem` (Pompa) e `SmartLamp` (Luce). Riceve i comandi di accensione/spegnimento e li stampa sul terminale.
- **`orchestrator.js`**: Un client WoT che agisce da "osservatore". Si connette ai dispositivi e ogni 5 secondi stampa i dati sul terminale. (Pronto per ospitare logiche di automazione in futuro).
- **`server.js` (Porta 3000)**: Un semplice server web Express che distribuisce l'interfaccia grafica al browser.

### Frontend (Web UI)
- **`src/index.html`**: Pagina iniziale per selezionare la pianta da monitorare.
- **`src/plant.html`**: La dashboard di monitoraggio reale.
- **`src/plant.js`**: La logica del client browser. Usa il `wot-bundle` per consumare le Thing Description esposte dai sensori, aggiorna la UI ogni 3 secondi e invia le azioni quando l'utente clicca sui pulsanti (toggle).
- **`output.css`**: Foglio di stile compilato e generato da **Tailwind CSS**.

---

##  Installazione e Avvio

### 1. Prerequisiti
Avere Node.js installato sul computer.

### 2. Installazione delle dipendenze
Aprire il terminale nella cartella del progetto e installare le dipendenze con i pacchetti necessari (come Express e node-wot):
```bash
npm install
```

### 3. Avvio del Sistema
Per avviare l'intero ecosistema (sensori, attuatori, orchestratore e server web della UI) contemporaneamente con un solo comando, esegui:

```bash
npm run start-all
```

### 4. Accesso alla Dashboard
Una volta avviato `server.js`,  il browser comparirà sulla pagina web:
http://localhost:3000

---

## Sviluppo e Stile (Tailwind CSS)
Il progetto utilizza **Tailwind CSS v4** per la grafica. Se si modificano le classi nei file `.html`, è necessario ricompilare il file CSS.
