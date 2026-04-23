# 🌱 Smart Plant Care

**Smart Plant Care** è un'applicazione basata sullo standard **Web of Things (WoT)** per il monitoraggio e la gestione automatizzata (simulata) di una serra o di una pianta domestica.

Il progetto utilizza la libreria `@node-wot/core` per creare dispositivi virtuali (sensori e attuatori) e offre un'interfaccia web moderna costruita con Tailwind CSS per monitorare lo stato in tempo reale e inviare comandi.

---

## Funzionamento del Sistema

Il sistema non si collega (per il momento) a sensori fisici reali, ma si affida a un **motore di simulazione temporale**. 
L'umidità del terreno e la luminosità reagiscono in modo realistico alle azioni dell'utente:
- Se l'utente accende la **Pompa dell'acqua** dall'interfaccia web, l'umidità sale progressivamente. Se la spegne, dopo 15 secondi di "inerzia" il terreno inizia ad asciugarsi.
- Se l'utente accende la **Lampada Smart**, la luminosità in Lux aumenta. Se la spegne, torna gradualmente al livello ambientale base.

Inoltre, un **Orchestratore** in background monitora costantemente i valori e interviene **automaticamente** per mantenere le condizioni ideali (accendendo o spegnendo pompa e luce quando si superano soglie critiche). L'interfaccia web rileva queste azioni e si aggiorna da sola, distinguendo nel registro gli interventi manuali da quelli automatici.

Tutta la comunicazione tra la dashboard web (il Client) e i dispositivi (i Server) avviene in HTTP scaricando e interpretando le **Thing Description **.

---

## Struttura del Progetto

L'architettura è divisa in script backend (dispositivi WoT) e frontend (Dashboard UI).

### Backend & Dispositivi IoT (Node.js)
- **`sensors.js` (Porta 8081)**: Espone i sensori `SoilMoistureSensor` (Umidità) e `LightSensor` (Luce). Contiene la logica matematica di simulazione temporale e di decadimento dei valori.
- **`actuators.js` (Porta 8082)**: Espone gli attuatori `IrrigationSystem` (Pompa) e `SmartLamp` (Luce). Riceve i comandi di accensione/spegnimento e possiede una proprietà `status` per permettere la lettura del loro stato reale.
- **`orchestrator.js`**: Un client WoT che agisce da "cervello" centrale. Si connette ai dispositivi, legge i dati ogni 5 secondi e implementa una **logica di automazione a soglie** per attivare e disattivare gli attuatori in autonomia, senza entrare in conflitto con i comandi dell'utente.
- **`server.js` (Porta 3000)**: Un semplice server web Express che distribuisce l'interfaccia grafica al browser.

### Frontend (Web UI)
- **`src/index.html`**: Pagina iniziale per selezionare la pianta da monitorare.
- **`src/plant.html`**: La dashboard di monitoraggio reale.
- **`src/plant.js`**: La logica del client browser. Usa il `wot-bundle` per consumare le Thing Description, aggiorna la UI ogni 3 secondi, invia i comandi manuali e **sincronizza visivamente gli interruttori** quando l'orchestratore agisce in background.
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
Il progetto utilizza **Tailwind CSS v4** per la grafica.
