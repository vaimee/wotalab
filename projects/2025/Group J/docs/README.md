# Smart Home Security System

**Progetto per il corso di Automazione - Università di Bologna (Unibo)**

## Descrizione del Progetto

Il progetto consiste nella progettazione e sviluppo di un sistema di sicurezza domestico simulato, basato sul paradigma **Web of Things (WoT)** secondo le specifiche W3C. L'architettura prevede un insieme di sensori/attuatori simulati (porta, finestra, movimento, sirena, notifiche) esposti come vere **WoT Thing** tramite la libreria `node-wot`, un orchestratore centrale che li consuma come vero **WoT Consumer**, un meccanismo di **discovery** (Thing Directory) che disaccoppia chi consuma le Thing da dove sono effettivamente in ascolto, e un'interfaccia web (Dashboard) che consuma anch'essa le Thing Description reali, non un'API proxy scritta a mano.

L'infrastruttura di comunicazione sfrutta:
- **HTTP, una porta dedicata per ciascuna Thing (3001-3005)**: ogni sensore/attuatore è un vero *Producer* `node-wot`, con la propria Thing Description generata automaticamente e i propri endpoint per property/action/event (protocollo HTTP binding di WoT; gli eventi sono serviti in long-polling, come dichiarato nei `forms` della TD).
- **HTTP (Porta 3009) - Thing Directory**: servizio di discovery WoT. Ogni Thing vi si autoregistra dopo essersi esposta; Orchestrator e Dashboard la interrogano per scoprire le Thing esistenti, invece di avere URL cablati nel codice.
- **HTTP (Porta 3000)**: serve la Dashboard statica ed espone solo ciò che *non* è già un'interazione WoT dichiarata in una TD (health check, property/action dell'Orchestrator - che non è una Thing -, cronologia allarmi/notifiche).
- **WebSocket (Porta 3000)**: canale di *push* verso il browser per aggiornare la Dashboard in tempo reale (log, allarmi). Non è un'interfaccia WoT: è solo la scorciatoia con cui il server notifica il client di eventi già avvenuti tramite l'`subscribeEvent` dell'Orchestrator.

> Nella prima versione del progetto esisteva anche un broker MQTT e un proxy REST manuale (`/things/*/properties`, `/things/*/actions`) che duplicava gli endpoint generati da `node-wot`: la Dashboard parlava con quel proxy, non con le vere Thing. Questa duplicazione è stata rimossa: la Dashboard oggi consuma direttamente gli `href` dichiarati nelle TD reali (vedi sezione "Architettura" nella `RELAZIONE_PROGETTO.md`).

## Struttura della Repository

- `src/index.js`: Entry point dell'applicazione. Avvia la Thing Directory, le Thing (Producer WoT), l'Orchestrator (Consumer WoT) e il server Express/WebSocket per la Dashboard.
- `src/directory/thingDirectory.js`: Thing Directory - servizio di discovery WoT. Raccoglie le TD autoregistrate dalle Thing ed espone `GET /things` (con filtro semantico opzionale `?type=<Classe>`), `GET /things/:id`, `.well-known/wot-thing-description`.
- `src/ontology/ontologyLoader.js`: carica `ontology/ontology.jsonld` e la usa realmente nel codice: risolve il `@type` semantico di ciascuna Thing e permette alla Directory di rispondere a query per classe (es. `Sensor`) risalendo le sottoclassi dichiarate nell'ontologia.
- `src/orchestrator/`: Contiene la logica di controllo (Orchestrator). Non riceve più URL di Thing hardcoded: scopre le TD interrogando la Thing Directory e le consuma con `WoT.consume()`.
- `src/things/`: Implementazione delle Thing WoT (DoorSensor, WindowSensor, MotionSensor, AlarmSystem, NotificationService), ciascuna un vero Producer `node-wot` con la propria TD autogenerata.
- `public/`: Dashboard (HTML/CSS/JS). Il client scopre le Thing dalla Directory e legge property / invoca action usando gli `href` dichiarati nelle rispettive TD, cioè funge da vero WoT Consumer.
- `ontology/ontology.jsonld`: ontologia di progetto (classi Thing/Sensor/Actuator/Service/Consumer, InteractionAffordance, ecc.), effettivamente caricata e usata dal codice (vedi `ontologyLoader.js`).
- `RELAZIONE_PROGETTO.md`: Documentazione tecnica di dettaglio e scelte progettuali.

## Requisiti di Sistema

- **Node.js** (versione consigliata: 18.x o superiore, per la disponibilità di `fetch` nativo usato dalle Thing per l'autoregistrazione nella Directory)
- **npm** (Node Package Manager)

## Istruzioni di Avvio

1. Clona la repository o accedi alla directory del progetto.
2. Installa le dipendenze necessarie eseguendo:
   ```bash
   npm install
   ```
3. Avvia il sistema:
   ```bash
   npm start
   ```
4. Accedi alla Dashboard aprendo un browser web al seguente indirizzo:
   ```
   http://localhost:3000
   ```

## Porte Utilizzate

| Porta | Componente | Ruolo WoT |
|-------|------------|-----------|
| 3000 | Server Express + WebSocket | Serve la Dashboard, espone endpoint dell'Orchestrator (non una Thing) |
| 3001 | Door Sensor | Producer WoT (TD reale su `/door-sensor`) |
| 3002 | Window Sensor | Producer WoT (TD reale su `/window-sensor`) |
| 3003 | Motion Sensor | Producer WoT (TD reale su `/motion-sensor`) |
| 3004 | Alarm System | Producer WoT (TD reale su `/alarm-system`) |
| 3005 | Notification Service | Producer WoT (TD reale su `/notification-service`) |
| 3009 | Thing Directory | Discovery WoT (`GET /things`) |

## Note sull'Esecuzione

All'avvio, `index.js` fa partire per prima la Thing Directory, poi ciascuna Thing: ognuna si espone come Producer `node-wot` sulla propria porta e, non appena pronta, si autoregistra nella Directory inviandole la propria Thing Description reale. Solo a questo punto viene avviato l'Orchestrator, che interroga la Directory (`GET /things`), consuma le TD trovate con `WoT.consume()` e si sottoscrive agli eventi dei sensori (`subscribeEvent`, via long-polling HTTP come dichiarato nei `forms`). Se la modalità sicurezza è attiva e un sensore segnala un'apertura o un movimento, l'Orchestrator invoca `triggerAlarm` e `sendNotification` sulle rispettive Thing consumate, e notifica la Dashboard via WebSocket per l'aggiornamento immediato dell'interfaccia. La Dashboard, dal canto suo, all'apertura scopre le Thing dalla Directory e da lì in avanti legge property/invoca action direttamente sugli `href` delle TD reali, senza passare da alcun proxy intermedio.