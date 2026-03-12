# Progetto (✅ APPROVATO)
## Gestione intelligente di una stanza tramite Web of Things


## Partecipanti  
**Gruppo:** C  

- Alex Cambrini - alex.cambrini@studio.unibo.it
- Lorenzo Ferrari - lorenzo.ferrari27@studio.unibo.it

---
---

## Architettura del Sistema e Panoramica Tecnica

Il sistema è basato sullo standard **W3C Web of Things (WoT)** ed è implementato utilizzando la libreria **Node-wot**.  
L'obiettivo è consentire la **gestione intelligente di una stanza** tramite un'architettura **IoT semantica e decentralizzata**.

La piattaforma integra diversi dispositivi smart, sensori ambientali e logiche di automazione coordinati da un componente centrale di orchestrazione.

---

## Componenti Principali

### Thing Models (TM)
I **Thing Models** definiscono le **capacità astratte dei dispositivi**, descrivendone proprietà, azioni ed eventi senza essere legati a una specifica istanza.

### Thing Descriptions (TD)
Le **Thing Descriptions** rappresentano le **istanze concrete dei Thing Models**.  
Espongono le funzionalità dei dispositivi tramite **endpoint HTTP** e includono metadati relativi ai pattern di interazione e alla sicurezza.

### Room Orchestrator
Il **Room Orchestrator** rappresenta l'elemento centrale di controllo del sistema.  
Raccoglie periodicamente i dati dai sensori e applica le regole di automazione che controllano gli attuatori, come illuminazione e sistema di riscaldamento.

### Ontologia Locale
Il sistema integra un livello semantico tramite il file `ontology.ttl`.

Questa ontologia consente di **classificare semanticamente i dispositivi**, ad esempio:

- `smart:Boiler`
- `smart:Window`
- `smart:RoomLight`

Questo approccio permette **ragionamento semantico e maggiore interoperabilità tra dispositivi**.

---

## Stack Tecnologico

| Livello | Tecnologie |
|--------|------------|
| Backend | Node.js, TypeScript, TSX |
| Frontend | Vue.js, Vite |
| Comunicazione | HTTP / REST |

## Analisi Dettagliata delle Thing

Ogni dispositivo del sistema è descritto tramite un **Thing Model (TM)** che ne definisce capacità, proprietà, azioni ed eventi.  
I Thing Models rappresentano il modello astratto dei dispositivi e vengono poi istanziati tramite **Thing Descriptions (TD)** esposte dal sistema.

---

### 1. House Controller (`house-controller.tm.json`)

Il **House Controller** gestisce lo stato globale del sistema e le funzionalità di sicurezza.

**Proprietà**
- `currentMode`  
  Modalità operativa corrente della casa (`HOME`, `NIGHT`, `ECO`, `AWAY`).

- `alarmActive`  
  Valore booleano che indica se l'allarme è attualmente attivo.

- `alarmReason`  
  Stringa descrittiva che specifica il motivo dell'attivazione dell'allarme.

- `targetTemperature[Home/Night/Eco/Away]`  
  Soglie di temperatura configurabili associate alle diverse modalità operative.

**Azioni**
- `setMode`  
  Permette di cambiare la modalità operativa della casa.

- `resetAlarm`  
  Disattiva un eventuale allarme attivo.

**Eventi**
- `alarmTriggered`  
  Evento emesso quando viene rilevata una violazione o una condizione di allarme.

---

### 2. Boiler Actuator (`boiler-actuator.tm.json`)

Questo attuatore controlla il sistema di riscaldamento ed è semanticamente classificato come `smart:Boiler`.

**Proprietà**
- `isOn`  
  Indica se la caldaia è attualmente accesa o spenta.

- `mode`  
  Modalità di funzionamento:
  - `auto`: controllata dall'orchestratore
  - `manual`: controllata direttamente dall'utente

**Azioni**
- `turnOn` – accende la caldaia  
- `turnOff` – spegne la caldaia  
- `toggle` – cambia lo stato corrente  
- `reset` – ripristina lo stato iniziale del dispositivo

---

### 3. Light Actuator (`light-actuator.tm.json`)

Attuatore dedicato al controllo dell'illuminazione della stanza, semanticamente classificato come `smart:RoomLight`.

Le **proprietà e le azioni** sono analoghe a quelle dell'attuatore della caldaia, ma applicate al sistema di illuminazione.

---

### 4. Sensori Ambientali

Il sistema include diversi sensori per il monitoraggio delle condizioni ambientali della stanza.

- **Temp/Humidity Sensor**  
  Monitora:
  - `temperature` (°C)
  - `humidityPct` (%)

- **Light Sensor**  
  Monitora:
  - `illuminanceLux` (Lux)

- **Presence Sensor**  
  Monitora:
  - `presence` (presenza o occupazione della stanza)

- **Window Sensor** (`smart:Window`)  
  Monitora:
  - `isOpen` (stato di apertura della finestra)

---

## Logiche di Controllo e Automazione

Il **Room Orchestrator** rappresenta il componente centrale di coordinamento del sistema.  
Esegue ciclicamente (circa **ogni secondo**) una serie di controlli sui dati provenienti dai sensori e applica le regole di automazione sugli attuatori della stanza.

---

### Gestione del Riscaldamento

Il sistema controlla la caldaia in base alla temperatura rilevata e alla modalità operativa della casa.

- **Controllo temperatura**
  La temperatura corrente viene confrontata con la **temperatura target** definita per la modalità attiva (`HOME`, `NIGHT`, `ECO`, `AWAY`).

- **Isteresi**
  Viene applicata un'isteresi di **±0.5°C** per evitare accensioni e spegnimenti troppo frequenti della caldaia.

- **Modalità automatica**
  Se l'attuatore è impostato in modalità `auto`, il controllo della caldaia è gestito dall'orchestratore.

- **Modalità manuale**
  Se l'attuatore è impostato in modalità `manual`, l'orchestratore **non interviene** sullo stato della caldaia, lasciando il controllo all'utente.

- **Finestra aperta**
  Se una finestra risulta aperta (`isOpen = true`), la caldaia viene **spenta automaticamente** per evitare sprechi energetici.

- **Modalità AWAY**
  Quando la casa è in modalità `AWAY`, il sistema **disattiva il riscaldamento** per ridurre il consumo energetico.

---

### Gestione Illuminazione

Il sistema gestisce automaticamente le luci della stanza in base alla presenza e alla luminosità ambientale.

- **Accensione automatica**
  Le luci si accendono se:
  - viene rilevata **presenza** (`presence = true`)
  - la luminosità ambientale è **inferiore a 200 Lux**

- **Spegnimento automatico**
  Le luci vengono spente quando:
  - la stanza è **vuota**
  - la modalità della casa è **ECO** o **AWAY**

- **Modalità manuale**
  Come per la caldaia, se l'attuatore delle luci è impostato in modalità `manual`, l'orchestratore **non modifica lo stato dell'illuminazione**.

---

### Sicurezza (Sistema Antifurto)

Il sistema integra un semplice meccanismo di sicurezza attivo quando la casa è in modalità **AWAY**.

L'allarme viene attivato se:

- viene rilevato **movimento nella stanza** (`presence = true`)
- viene **aperta una finestra** (`isOpen = true`)

Quando una di queste condizioni si verifica:

- la proprietà `alarmActive` viene impostata a `true`
- viene registrato il motivo nella proprietà `alarmReason`
- viene emesso l'evento `alarmTriggered`

L'allarme può essere successivamente **ripristinato manualmente** tramite l'azione `resetAlarm` del **House Controller**.

---

### Coordinamento con le Modalità della Casa

Il comportamento dell'intero sistema dipende dalla modalità operativa impostata nel **House Controller**:

- **HOME** → funzionamento normale
- **NIGHT** → temperatura ridotta e gestione energetica
- **ECO** → riduzione dei consumi
- **AWAY** → modalità assenza con attivazione del sistema antifurto

## Esecuzione e Accesso

Questa sezione descrive come avviare il sistema e accedere alle principali interfacce e risorse esposte dall'applicazione.

---

### Avvio del Sistema

Per avviare sia il **backend** (WoT Servient e simulazione dei dispositivi) sia il **frontend** (dashboard utente):

1. Posizionarsi nella **root del progetto**.
2. Installare le dipendenze ed eseguire l'applicazione:

```bash
npm install
npm run dev
```

Il comando avvierà:

- il **WoT Servient**, che espone le *Thing Descriptions* e gestisce i dispositivi simulati
- il **frontend Vue**, che fornisce l'interfaccia di controllo del sistema

---

## Accesso alle Thing Descriptions (TD)

Una volta avviato il backend, le **Thing Descriptions** dei dispositivi sono accessibili tramite endpoint HTTP locali.

### Esempi

- **Boiler Actuator TD**  
  `http://localhost:8080/boileractuator`

- **House Controller TD**  
  `http://localhost:8080/housecontroller`

- **Light Actuator TD**  
  `http://localhost:8080/lightactuator`

- **Temperature & Humidity Sensor TD**  
  `http://localhost:8080/temphumiditysensor`

- **Light Sensor TD**  
  `http://localhost:8080/lightsensor`

- **Presence Sensor TD**  
  `http://localhost:8080/presencesensor`

- **Window Sensor TD**  
  `http://localhost:8080/windowsensor`

Questi endpoint restituiscono documenti **JSON-LD** che descrivono le capacità e le interazioni disponibili per ciascun dispositivo.

---

## Dashboard Utente

L'interfaccia web è disponibile all'indirizzo:

`http://localhost:5173`

La dashboard sviluppata con **Vue.js** consente di:

- monitorare in tempo reale lo stato dei dispositivi
- visualizzare i dati dei sensori ambientali
- controllare manualmente gli attuatori
- modificare le modalità operative del sistema tramite l'**Admin Panel**
