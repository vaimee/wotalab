# Relazione di Progetto: Smart Home Security System (WoT)

**Corso di Automazione**
**Alma Mater Studiorum - Università di Bologna**

---

## 1. Introduzione

Il progetto implementa un sistema di Smart Home Security basato sul paradigma **Web of Things (WoT)** secondo le specifiche W3C (Thing Description v1.1, WoT Discovery). Ogni dispositivo (sensore porta, sensore finestra, sensore di movimento, sirena di allarme, servizio notifiche) è realizzato come una vera **WoT Thing**: un `ExposedThing` prodotto con la libreria `node-wot`, con una Thing Description (TD) generata realmente dal runtime — non scritta a mano — ed esposta tramite HTTP binding. Un **Orchestrator** e una **Dashboard** web fungono da **WoT Consumer**: non conoscono a priori dove si trovano le Thing, le scoprono interrogando una **Thing Directory**, e interagiscono con esse esclusivamente attraverso ciò che le rispettive TD dichiarano (property, action, event), leggendo gli `href` dai `forms`.

Il sistema fa inoltre un uso concreto, non solo documentale, dell'ontologia di progetto (`ontology/ontology.jsonld`): ogni Thing dichiara nella propria TD un `@type` semantico risolto dinamicamente dall'ontologia, e la Thing Directory può rispondere a query per classe (es. "dammi tutti i `Sensor`") risalendo la gerarchia `subClassOf` definita nell'ontologia stessa.

### 1.1 Evoluzione rispetto alla versione iniziale

Una prima versione del progetto presentava tre problemi architetturali, individuati in fase di revisione e risolti nella versione qui documentata:

1. **Doppia implementazione ridondante.** Ogni Thing veniva esposta due volte: una volta "vera" da `node-wot` su una porta dedicata (con TD autogenerata), e una volta come proxy REST scritto a mano in `index.js` sulla porta 3000 (es. `app.get('/things/door-sensor/properties/isOpen', ...)`). La Dashboard parlava con il proxy, non con la Thing reale: l'interfaccia utente non consumava effettivamente le TD generate da `node-wot`. Il proxy manuale è stato **rimosso integralmente**; la Dashboard ora scopre e consuma direttamente gli endpoint reali.
2. **Assenza di discovery.** Non esisteva alcun meccanismo di WoT Discovery (Thing Directory, `.well-known/wot-thing-description`): gli URL delle Thing erano hardcoded nell'Orchestrator. È stata introdotta una **Thing Directory** dedicata (§4.3) che elimina ogni URL cablato nel codice.
3. **Ontologia puramente documentale.** `ontology.jsonld` era concettualmente ben strutturata (classi `Sensor`/`Actuator`/`Thing`) ma non referenziata da nessuna parte nel codice. È stato introdotto un modulo (`ontologyLoader.js`, §4.5) che la carica realmente a runtime e la usa sia per annotare semanticamente le TD sia per il filtraggio semantico nella Directory.

## 2. Architettura del Sistema

L'architettura è quella di un sistema WoT a tre ruoli distinti, come previsto dal WoT Architecture (W3C):

- **Producer**: le cinque Thing (`DoorSensor`, `WindowSensor`, `MotionSensor`, `AlarmSystem`, `NotificationService`), ciascuna un processo `node-wot` `Servient` indipendente in ascolto su una porta HTTP propria (3001–3005).
- **Directory**: la Thing Directory (porta 3009), un servizio di *registration & discovery* verso cui le Producer si autoregistrano e presso cui i Consumer scoprono le Thing disponibili.
- **Consumer**: l'Orchestrator (logica applicativa server-side) e la Dashboard (client browser), entrambi WoT Consumer nel senso stretto del termine — non contengono conoscenza cablata delle Thing, le scoprono e le consumano tramite TD.

Un server Express separato (porta 3000) fa da collante applicativo: serve i file statici della Dashboard, espone il canale WebSocket di push verso il browser, ed espone le uniche interazioni che *non* sono affordance dichiarate in una TD di dispositivo — perché l'Orchestrator stesso non è modellato come una Thing (vedi ontologia, classe `proj:Consumer`), ma come applicazione che ne coordina altre.

```
┌───────────────┐   auto-registrazione TD   ┌─────────────────────┐
│ Door Sensor    │ ────────────────────────▶│                     │
│ (Producer,3001)│                           │  Thing Directory    │
├───────────────┤                           │  (porta 3009)       │
│ Window Sensor  │ ────────────────────────▶│  GET /things         │
│ (Producer,3002)│                           │  GET /things?type=…  │
├───────────────┤                           │  .well-known/wot-td  │
│ Motion Sensor  │ ────────────────────────▶│                     │
│ (Producer,3003)│                           └──────────▲──────────┘
├───────────────┤                                      │ discovery
│ Alarm System   │ ────────────────────────▶            │ (GET /things)
│ (Producer,3004)│                           ┌──────────┴──────────┐
├───────────────┤                           │   Orchestrator       │
│ Notification   │ ────────────────────────▶│   (Consumer WoT)     │
│ Svc (Prod,3005)│                           │   invokeAction /      │
└───────┬────────┘                           │   readProperty /      │
        │ readProperty / invokeAction        │   subscribeEvent      │
        │ (href dai forms TD)                └──────────┬──────────┘
        │                                                │ WebSocket push
        ▼                                                ▼
┌────────────────────────────────────────────────────────────────┐
│  Dashboard (browser, Consumer WoT) — porta 3000 (statica)       │
│  scopre da Directory → legge/invoca via href dei forms delle TD  │
└────────────────────────────────────────────────────────────────┘
```

## 3. Protocolli di Comunicazione

- **HTTP (porte 3001–3005), WoT HTTP binding**: ciascuna Thing espone property, action ed event dichiarati nella propria TD. Gli event sono serviti in long-polling, come da `forms` generati da `node-wot`; non c'è alcun canale di trasporto "nascosto" scelto fuori standard. Ogni endpoint monta CORS (`config.middleware`) perché la Dashboard, in esecuzione su un'altra origin (porta 3000), possa consumarlo direttamente da browser.
- **HTTP (porta 3009), WoT Discovery**: la Thing Directory espone `POST /things` (auto-registrazione), `GET /things` (elenco, con filtro semantico opzionale `?type=<Classe>`), `GET /things/:id` e il proprio *well-known URL* (`/.well-known/wot-thing-description`), coerente con l'introduction mechanism previsto da WoT Discovery.
- **HTTP (porta 3000)**: server applicativo. Serve la Dashboard statica ed espone *solo* ciò che non duplica un'interazione già dichiarata in una TD di dispositivo: health check, property/action dell'Orchestrator, cronologia allarmi/notifiche per la UI.
- **WebSocket (porta 3000)**: canale di push verso il browser, usato **esclusivamente** per notificare in tempo reale eventi già avvenuti lato server (allarme scattato, sensore variato, modalità sicurezza cambiata). Non è un'interfaccia WoT alternativa: la Dashboard non legge mai lo stato "vero" di una Thing da qui, lo legge dagli endpoint reali; il WebSocket serve solo a evitare polling aggressivo per l'aggiornamento istantaneo della UI.

Non esiste più alcun broker MQTT: nella prima versione veniva usato come canale pub/sub tra sensori e Orchestrator, ma duplicava una funzionalità già coperta, in modo standard, dal meccanismo `subscribeEvent` di WoT sul binding HTTP (long-polling sui `forms` di tipo evento della TD). Mantenerlo avrebbe significato avere due canali paralleli per la stessa informazione — lo stesso tipo di ridondanza già identificata per il proxy REST.

## 4. Dettaglio dei Componenti

### 4.1 Le Thing (Producer)

Ogni Thing (`src/things/*.js`) segue lo stesso schema:

1. Istanzia un `Servient` `node-wot` e vi aggiunge un `HttpServer` con:
   - `baseUri` esplicito (`http://localhost:<porta>`), in modo che gli `href` generati nei `forms` siano deterministici e raggiungibili dal browser (senza questo parametro, `node-wot` sceglie in automatico un indirizzo di rete dell'host, non sempre adatto ad un deployment locale);
   - `middleware: cors()`, per permettere alla Dashboard di invocare l'endpoint da un'altra origin.
2. Produce (`WoT.produce`) la TD dichiarando `@context` (TD v1.1 + `@language` + prefisso dell'ontologia di progetto), `@type` (risolto da `ontologyLoader.getClass(...)`, es. `proj:DoorSensor`), `id`, `title`, `properties`, `actions`, `events`.
3. Registra gli handler (`setPropertyReadHandler`, `setActionHandler`) ed espone la Thing (`expose()`), a questo punto realmente raggiungibile e interrogabile da chiunque via HTTP.
4. Si **autoregistra** nella Thing Directory inviando la propria TD reale (`POST {directoryUrl}/things`), così da essere scopribile senza che nessun altro componente ne conosca la porta a priori.

Le azioni "di test/simulazione" (es. `setOpen` sul sensore porta) restano dichiarate come vere `action` WoT nella TD: la Dashboard le invoca tramite l'`href` che la TD stessa dichiara, non tramite un endpoint parallelo.

### 4.2 L'Orchestrator (Consumer)

`src/orchestrator/orchestrator.js` rappresenta la logica applicativa. All'avvio:

1. Interroga la Thing Directory (`GET {directoryUrl}/things`) per ottenere l'elenco delle TD registrate — **discovery**, non un URL fisso.
2. Per ciascun ruolo applicativo (door/window/motion sensor, alarm system, notification service) individua la TD corrispondente per `title` e la consuma con `WoT.consume(td)`, ottenendo un `ConsumedThing`.
3. Si sottoscrive agli eventi dei sensori (`subscribeEvent`), che arrivano via long-polling HTTP secondo quanto dichiarato nei `forms` della TD.

La logica di sicurezza prevede due stati (`securityMode` attivo/inattivo). Se la sicurezza è attiva e un sensore segnala un'apertura o un movimento, l'Orchestrator invoca `triggerAlarm` sull'`AlarmSystem` consumato e `sendNotification` sul `NotificationService` consumato — sempre tramite `invokeAction()` sul `ConsumedThing`, mai chiamando direttamente un metodo JavaScript dell'istanza — e notifica la Dashboard via WebSocket per l'aggiornamento immediato della UI.

### 4.3 La Thing Directory (Discovery)

`src/directory/thingDirectory.js` è il componente introdotto per colmare l'assenza di discovery della versione iniziale. Espone:

- `POST /things`: registrazione (usata dalle Thing dopo l'`expose()`);
- `GET /things` e `GET /things/:id`: elenco/dettaglio delle TD registrate;
- `GET /things?type=<Classe>`: filtro **semantico**. La query non confronta stringhe: risolve `<Classe>` a un IRI dell'ontologia di progetto e verifica, per ciascuna TD registrata, se il suo `@type` è quella classe o una sua sottoclasse, risalendo i legami `subClassOf` dichiarati in `ontology.jsonld` (es. `?type=Sensor` restituisce `DoorSensor`, `WindowSensor` e `MotionSensor` pur non essendo nessuno letteralmente etichettato `"Sensor"`);
- `GET /.well-known/wot-thing-description`: TD della Directory stessa, coerente con l'introduction mechanism di WoT Discovery.

Orchestrator e Dashboard sono gli unici due consumatori di questo servizio: nessuno dei due contiene più una singola porta o URL di Thing cablato nel codice.

### 4.4 La Dashboard (Consumer)

`public/index.html` implementa lato browser un client WoT minimale:

1. Alla `DOMContentLoaded`, interroga la Thing Directory e costruisce una mappa `title → TD`.
2. Per leggere una property (`readProperty(title, prop)`) o invocare una action (`invokeAction(title, action, input)`), individua il `form` corrispondente nella TD reale e ne usa `href` e `htv:methodName` — esattamente ciò che dichiara la TD, non un contratto REST inventato a parte.
3. Le uniche chiamate della Dashboard che *non* passano da questo meccanismo sono verso `/orchestrator/properties/securityMode` e `/orchestrator/actions/*` sul server applicativo (porta 3000): per costruzione l'Orchestrator non è una Thing e quindi non ha una propria TD da consumare.
4. Il canale WebSocket resta collegato in parallelo solo per ricevere push di eventi già avvenuti (per aggiornare la UI senza fare polling continuo); lo stato "di verità" viene comunque letto dagli endpoint reali delle Thing.

### 4.5 L'Ontologia e il suo uso reale

`src/ontology/ontologyLoader.js` carica `ontology/ontology.jsonld` da disco (non è una copia incollata a mano, è lo stesso file usato come documentazione semantica del dominio) ed espone:

- `getClass(label)`: risolve un'etichetta (es. `"DoorSensor"`) all'IRI compatto della classe ontologica corrispondente (es. `"proj:DoorSensor"`). Se la classe non esiste nell'ontologia, la Thing **non si avvia** — è una dipendenza funzionale, non un commento;
- `getOntologyContext()`: il prefisso JSON-LD (`proj: <IRI>`) da aggiungere al `@context` della TD, in modo che `@type` sia risolvibile a un IRI assoluto e non un semplice tag di comodo;
- `isSubClassOf(childId, ancestorId)`: percorre ricorsivamente i legami `subClassOf` dell'ontologia, usato dalla Thing Directory per le query semantiche (§4.3).

Questo chiude il divario identificato nella revisione iniziale: l'ontologia non è più solo un file di documentazione concettuale, ma un input effettivo che condiziona sia la generazione delle TD sia il comportamento della Directory.

## 5. Verifica e Collaudo

Il collaudo funzionale, eseguito end-to-end sull'intero sistema avviato con `npm start`, ha verificato:

1. **Discoverability**: all'avvio, tutte e cinque le Thing si autoregistrano correttamente nella Thing Directory (`GET /things` restituisce le cinque TD reali, con `@type` popolato); l'Orchestrator, avviato solo dopo, le scopre e le consuma tutte con successo tramite `WoT.consume()`.
2. **Query semantica**: `GET /things?type=Sensor` restituisce correttamente `Door Sensor`, `Window Sensor` e `Motion Sensor` (e nessun altro), confermando che la risoluzione delle sottoclassi tramite `ontology.jsonld` funziona come previsto.
3. **Consumo reale delle TD da parte della Dashboard**: letture di property (es. `isOpen` del Door Sensor) e invocazioni di action (es. `setOpen`) effettuate tramite gli `href` dichiarati nei `forms` della TD raggiungono correttamente l'endpoint `node-wot` sulla porta dedicata (3001), incluso il preflight CORS richiesto da una chiamata cross-origin da browser.
4. **Correttezza end-to-end della logica di sicurezza**: con `securityMode` attivo, l'apertura simulata della porta (invocata sulla TD reale) fa scattare, tramite l'evento sottoscritto dall'Orchestrator (`subscribeEvent`, non più MQTT), sia il cambio di stato dell'`AlarmSystem` (`RESET → TRIGGERED`) sia la registrazione di un alert consultabile dalla Dashboard.
5. **Assenza di duplicazione**: verificato che nessun endpoint del server applicativo (porta 3000) replica più un'interazione già dichiarata in una TD di dispositivo — la Dashboard non ha più alcuna via per aggirare le TD reali.

## 6. Conclusioni

La revisione ha eliminato la ridondanza tra endpoint `node-wot` autogenerati e proxy REST manuale, rendendo la Dashboard un vero WoT Consumer che dipende, per costruzione, dalle Thing Description reali e non da un'API parallela mantenuta a mano. L'introduzione della Thing Directory copre il requisito di discoverability previsto dallo standard WoT, sostituendo gli URL hardcoded con un meccanismo di registrazione e scoperta esplicito. Infine, l'ontologia di progetto è stata trasformata da artefatto puramente documentale a componente attivo del sistema, usato sia per l'annotazione semantica delle TD sia per il ragionamento (query per sottoclasse) nella Directory. Il risultato è un sistema in cui l'unica interfaccia autorevole verso ciascun dispositivo è la sua Thing Description, coerentemente con il paradigma Web of Things.