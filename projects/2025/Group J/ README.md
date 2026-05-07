# Smart Home Security System – Progetto Web of Things

## Panoramica

Questo progetto implementa un sistema intelligente di sicurezza domestica basato sul paradigma Web of Things (WoT).

Il sistema monitora un ambiente domestico utilizzando sensori e attuatori interconnessi, esposti come WoT Things tramite Thing Description (TD) standardizzate.

Quando la modalità sicurezza (“Away Mode”) è attiva, il sistema reagisce automaticamente a eventi sospetti come apertura di porte/finestre o rilevamento di movimento, attivando allarmi e notifiche.

Il progetto dimostra come il paradigma WoT permetta interoperabilità, modularità e astrazione tra dispositivi fisici e logica applicativa.

---

# Obiettivi del progetto

Gli obiettivi principali del progetto sono:

- sviluppare un sistema di sicurezza domestica basato su WoT
- esporre i dispositivi come WoT Things interoperabili
- implementare la comunicazione tramite protocol bindings HTTP e MQTT
- gestire eventi in tempo reale e logiche di automazione
- progettare il sistema secondo un’architettura Digital Twin
- garantire astrazione hardware e modularità

---

# Architettura del sistema

Il sistema segue il modello WoT Servient ed è composto dai seguenti componenti.

## Things (Producer)

Dispositivi esposti come WoT Things:

- Door Sensor
- Window Sensor
- Motion Sensor
- Alarm System
- Notification Service

Ogni Thing espone:
- Properties
- Actions
- Events
- Thing Description (TD)

---

## Orchestrator (Consumer)

L’orchestratore gestisce la logica applicativa e coordina le interazioni tra le Things.

Responsabilità principali:
- sottoscrizione agli eventi dei sensori
- valutazione delle condizioni di sicurezza
- attivazione allarmi
- invio notifiche
- sincronizzazione dello stato del sistema

---

## Web Dashboard

La dashboard consente all’utente di:

- attivare/disattivare la modalità sicurezza
- monitorare i sensori
- visualizzare allarmi e notifiche
- osservare lo stato del sistema in tempo reale

---

# Architettura Digital Twin

Un aspetto fondamentale del progetto è l’utilizzo di un’architettura basata sul concetto di Digital Twin.

Ogni dispositivo fisico viene rappresentato tramite una WoT Thing che espone interfacce standardizzate attraverso Thing Description.

Attualmente sensori e attuatori sono simulati tramite software mockup. Tuttavia, il sistema è progettato in modo che i dispositivi simulati possano essere sostituiti in futuro da hardware reale senza modificare la logica dell’orchestratore o della dashboard.

Questo significa che:
- la Thing Description rimane invariata
- le interfacce di comunicazione rimangono invariate
- i topic MQTT rimangono invariati
- la logica applicativa rimane invariata

Cambia solamente l’implementazione interna del dispositivo.

Ad esempio:

- oggi → sensore di movimento simulato in Node.js
- futuro → sensore PIR reale collegato a ESP32 o Raspberry Pi

Entrambe le implementazioni espongono:
- le stesse properties
- le stesse actions
- gli stessi events
- gli stessi protocol bindings

Questo approccio dimostra:
- astrazione hardware
- interoperabilità
- loose coupling
- progettazione modulare secondo il paradigma WoT

---

# Flusso di interazione del sistema

## Modalità sicurezza attiva

Quando `securityMode = ON`:

1. un sensore rileva un evento
2. l’evento viene pubblicato tramite MQTT
3. l’orchestratore riceve l’evento
4. l’orchestratore valuta le regole di sicurezza
5. il sistema di allarme viene attivato
6. viene generata una notifica
7. la dashboard aggiorna lo stato del sistema

---

## Modalità sicurezza disattiva

Quando `securityMode = OFF`:

- i sensori continuano il monitoraggio
- gli eventi possono essere visualizzati
- nessun allarme automatico viene attivato

---

# WoT Things

## Door Sensor

Sensore che rileva apertura e chiusura della porta.

### Properties
- `isOpen`

### Events
- `doorOpened`

---

## Window Sensor

Sensore che rileva apertura e chiusura delle finestre.

### Properties
- `isOpen`

### Events
- `windowOpened`

---

## Motion Sensor

Sensore che rileva movimento all’interno dell’ambiente.

### Properties
- `motionDetected`

### Events
- `motionDetected`

---

## Alarm System

Sistema responsabile dell’attivazione e del reset dell’allarme.

### Properties
- `alarmStatus`

### Actions
- `triggerAlarm()`
- `resetAlarm()`

### Events
- `alarmTriggered`

---

## Notification Service

Servizio che simula l’invio di notifiche all’utente.

### Actions
- `sendNotification()`

---

# Properties, Actions ed Events

Il sistema utilizza il modello di interazione WoT.

## Properties

Utilizzate per esporre lo stato corrente dei dispositivi.

Esempi:
- `isOpen`
- `motionDetected`
- `alarmStatus`
- `securityMode`

---

## Actions

Utilizzate per invocare operazioni sulle Things.

Esempi:
- `activateSecurityMode()`
- `deactivateSecurityMode()`
- `triggerAlarm()`
- `resetAlarm()`

---

## Events

Utilizzati per comunicazione asincrona.

Esempi:
- `doorOpened`
- `windowOpened`
- `motionDetected`
- `alarmTriggered`

---

# Protocolli di comunicazione

Il progetto utilizza diversi protocol bindings WoT.

## HTTP

Utilizzato per:
- accesso alle Thing Description
- lettura delle properties
- invocazione delle actions

---

## MQTT

Utilizzato per:
- comunicazione eventi in tempo reale
- messaggistica publish/subscribe
- notifiche asincrone

La combinazione di HTTP e MQTT permette di separare le operazioni sincrone di controllo dalla gestione asincrona degli eventi.

---

# Annotazioni semantiche

Le Thing Description sono rappresentate tramite JSON-LD e includono annotazioni semantiche conformi agli standard WoT.

I metadati semantici migliorano:
- interoperabilità
- discoverability
- interpretabilità machine-readable
- estendibilità futura

---

# Scenario di esempio

## Esempio: rilevamento intrusione

1. L’utente attiva la modalità Away
2. Il Door Sensor rileva apertura porta
3. Il Door Sensor pubblica `doorOpened`
4. L’orchestratore riceve l’evento
5. L’Alarm System esegue `triggerAlarm()`
6. Il Notification Service invia una notifica
7. La dashboard visualizza lo stato dell’allarme

---

# Tecnologie utilizzate

## Backend
- Node.js
- node-wot

## Frontend
- HTML
- CSS
- JavaScript

## Protocolli
- HTTP
- MQTT

## Formati dati
- JSON
- JSON-LD

---

# Obiettivi didattici

Questo progetto dimostra l’applicazione pratica di:

- architettura Web of Things
- Thing Description
- protocol bindings
- sistemi event-driven
- orchestrazione distribuita di dispositivi
- concetti di Digital Twin
- astrazione hardware
- sistemi IoT interoperabili
