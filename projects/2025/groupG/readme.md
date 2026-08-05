# Membri del gruppo

Matteo Manganiello (matteo.manganiello@studio.unibo.it)

# WoT-ProActiveDrive
### Digital Twin di un propulsore ibrido basato su W3C Web of Things

## Sommario

Il progetto propone un **Digital Twin** di un propulsore ibrido (motore a combustione interna + motore elettrico + pacco batteria) realizzato secondo lo standard **W3C Web of Things (WoT)**. Il sistema simula in tempo reale la dinamica del powertrain, ne espone lo stato attraverso *Thing Description* interoperabili su due binding (HTTP e MQTT) e ne consente il controllo remoto tramite una dashboard web. La parte digitale è mantenuta separata da quella fisica: ogni componente può essere sostituito da un dispositivo reale senza modificare il livello WoT, e il gemello continua a funzionare qualunque sia la combinazione di parti reali presenti. L'obiettivo è dimostrare come i principi del Web of Things — descrizione semantica dei dispositivi, disaccoppiamento dei protocolli e interazione uniforme — possano essere applicati a un caso d'uso di *proactive maintenance* e gestione energetica nell'ambito automotive.

## 1. Introduzione e motivazione

I veicoli ibridi ed elettrici generano grandi volumi di dati eterogenei (parametri termici, elettrici e meccanici) provenienti da sottosistemi diversi. L'assenza di uno strato di descrizione comune rende difficile l'integrazione, il monitoraggio e la manutenzione predittiva. Il **Web of Things** affronta questo problema di frammentazione introducendo un modello di astrazione basato sul Web: ogni dispositivo (*Thing*) è descritto da un documento formale (*Thing Description*) che ne dichiara capacità e modalità di accesso, indipendentemente dal protocollo di trasporto sottostante.

In questo contesto il progetto realizza un **gemello digitale** che:
- riproduce il comportamento fisico del propulsore tramite un modello di simulazione;
- rende osservabili le grandezze di interesse come *interaction affordances* WoT;
- attua politiche di controllo e diagnostica reattiva basate su soglie;
- resta operativo in presenza di una o più parti fisiche reali, degradando automaticamente sul modello quando queste non sono disponibili.

## 2. Obiettivi

1. **Interoperabilità** — modellare il propulsore come insieme di *Thing* WoT auto-descrittive, conformi alla Thing Description del W3C.
2. **Monitoraggio in tempo reale** — esporre telemetria continua (stato di carica, temperatura, efficienza, autonomia) e visualizzarla in una dashboard.
3. **Manutenzione proattiva** — rilevare e notificare condizioni di rischio (surriscaldamento, degrado batteria, bassa autonomia, anomalie di efficienza) mediante *eventi* asincroni.
4. **Controllo remoto** — permettere il cambio di modalità di guida e la gestione della frenata rigenerativa tramite *azioni*.
5. **Disaccoppiamento dei protocolli** — sfruttare i *binding templates* di node-wot per esporre le medesime affordance, dichiarate una sola volta, su due protocolli (HTTP e MQTT), con degradazione controllata in assenza del broker.
6. **Separazione fra parte digitale e parte fisica** — rendere ogni componente sostituibile da un dispositivo reale senza modificare il livello WoT, garantendo la continuità del servizio in qualunque combinazione di parti simulate e reali.

## 3. Background: il modello di interazione WoT

Lo standard W3C WoT definisce tre tipi di *interaction affordance* che una Thing può esporre e che sono qui integralmente utilizzati:

| Affordance | Semantica | Uso nel progetto |
|------------|-----------|------------------|
| **Properties** | Stato osservabile e leggibile | SoC, SoH, RPM, coppia, temperatura, efficienza, autonomia, modalità |
| **Actions** | Invocazione di funzioni che modificano lo stato | `setDriveMode`, `triggerRegen` |
| **Events** | Notifiche asincrone su condizioni | `criticalOverheat`, `lowEnergyWarning`, `anomalyDetected` |

Ogni Thing pubblica la propria **Thing Description** in formato JSON-LD (`@context` W3C WoT), completa di `securityDefinitions` (schema `nosec` per il contesto dimostrativo). Un client (*consumer*) può quindi scoprire dinamicamente le funzionalità del dispositivo leggendone la TD, senza conoscenza a priori dell'interfaccia — proprietà chiave per la scalabilità e l'aggiunta di nuovi sensori.

## 4. Architettura del sistema

Il sistema è composto da tre **Thing** WoT, ciascuna con la propria Thing Description auto-descrittiva:

| Thing | Ruolo | Espone |
|-------|-------|--------|
| **PowerUnit** | Motore ibrido (ICE + elettrico) | SoC, RPM, coppia, temperatura, efficienza, autonomia + azioni + eventi |
| **EnergyStorage** | Pacco batteria | SoC, SoH, tensione, corrente, temperatura |
| **ControlActuator** | Attuatore di controllo | Modalità di guida, frenata rigenerativa + azioni di comando |

**Separazione fra parte digitale e parte fisica**

Il livello WoT non conosce l'origine del dato. Ogni componente dispone di una **porta** (`src/sources/types.ts`) con due implementazioni intercambiabili: `SimulatedSource`, proiezione del modello fisico, e `DeviceSource`, dispositivo reale che pubblica le proprie misure via MQTT. La sostituzione è **granulare e dichiarata a runtime** (`REAL_COMPONENTS=energyStorage`), così da poter rendere reale il solo pacco batteria lasciando simulato tutto il resto.

Tre proprietà rendono il sistema robusto alla presenza di parti reali:
- **misure parziali** — un dispositivo che pubblica solo alcune grandezze copre quelle; le altre restano stimate dal modello;
- **degradazione automatica** — se il dispositivo tace oltre la finestra di validità (`DEVICE_STALENESS_MS`), la sorgente torna da sola alla simulazione e il gemello continua a rispondere;
- **riallineamento** — quando il dispositivo torna a pubblicare, il gemello si riallinea al ciclo successivo senza alcun intervento.

Ogni campione di telemetria dichiara la provenienza del dato nel campo `origins`, così un consumer distingue ciò che è misurato da ciò che è stimato. Le soglie degli eventi sono valutate sullo stato *effettivo* del gemello: con il pacco batteria reale collegato, è la sua temperatura misurata a far scattare l'allarme.

Per dimostrare la sostituzione senza hardware, `scripts/fake-device.ts` emula un componente fisico; sta deliberatamente **fuori** dal gemello, poiché rappresenta la parte reale del sistema.

**Consumer WoT**
- **Diagnostic Tool** — legge periodicamente le proprietà via HTTP e segnala i rischi (surriscaldamento, degrado del SoH, autonomia bassa) applicando soglie diagnostiche.
- **Predictive Dashboard** — interfaccia web che interroga via HTTP le proprietà di *PowerUnit* e *ControlActuator*, ne mostra l'andamento storico e invia i comandi di controllo.
- **Energy Orchestrator** — consumer di riferimento per la gestione automatica della coppia (incluso a scopo architetturale; disattivato in favore del controllo manuale da dashboard).

**Comunicazione: due binding template**

Le *interaction affordance* sono dichiarate **una sola volta** nelle Thing Description; è node-wot a generare, per ciascuna, una `form` per ogni binding attivo. Un consumer legge la TD e sceglie la form che sa interpretare, senza che il suo codice cambi: è questa la potenzialità dei *binding templates*.

| Binding | Semantica | Ruolo |
|---------|-----------|-------|
| `@node-wot/binding-http` | sincrono, request/response | Thing Description, lettura proprietà, invocazione azioni |
| `@node-wot/binding-mqtt` | asincrono, publish/subscribe | osservazione proprietà, sottoscrizione eventi, comandi |

La medesima proprietà risulta così esposta su entrambi i protocolli:

```
readproperty, observeproperty  ->  http://localhost:8080/powerunit/properties/batterySoC
readproperty, observeproperty  ->  mqtt://localhost:1883/PowerUnit/properties/batterySoC
```

Le form MQTT adottano il vocabolario `mqv:` dei binding templates (ad esempio `mqv:qos: 2` sugli eventi). Il servient lato consumer registra entrambe le *client factory* (`src/consumers/wot-client.ts`), per cui la medesima invocazione `invokeAction` viaggia indifferentemente su HTTP o su MQTT a seconda della form selezionata nella TD.

Il broker **non richiede installazione**: se nessun broker risponde il runtime ne ospita uno *embedded* (aedes, tramite `selfHost`); se un broker esterno è presente vi si collega; se MQTT è disabilitato o non avviabile il sistema degrada in modo controllato alla sola modalità HTTP, garantendo la continuità del servizio.

Accanto alle form generate dal binding, la telemetria aggregata dell'intero gemello viaggia su un topic unico `wot/proactivedrive/telemetry`: è un canale di comodo per il monitoraggio, distinto dalla via interoperabile descritta nelle Thing Description.

## 5. Modello di simulazione

Il gemello digitale è guidato da un modello a tempo discreto (passo di 2 s) che, ad ogni ciclo, aggiorna in modo accoppiato le seguenti grandezze:

- **Cinematica**: velocità con andamento sinusoidale modulato dalla modalità di guida (offset per Sport / Full Electric).
- **Coppia e regime motore**: funzione della domanda di velocità e della modalità; determinano lo stato del motore termico (`Off` / `Idle` / `Running`).
- **Bilancio energetico della batteria**: consumo dipendente da modalità, domanda e stato di carica, con recupero da **frenata rigenerativa** in fase di decelerazione.
- **Modello termico**: riscaldamento per carico/velocità/Sport, raffreddamento per flusso d'aria e rigenerazione; da esso derivano `thermalHealth` e l'usura (`SoH`) della batteria.
- **Efficienza di sistema**: efficienza istantanea (km/kWh) filtrata con una media mobile esponenziale (EMA), per riflettere il consumo reale evitando transitori all'avvio.

Le modalità di guida (`Full Electric`, `Hybrid`, `Sport`, `Save`) e l'intensità di rigenerazione (1–3) costituiscono le variabili di controllo esposte tramite azioni. Una modalità di *stress* (`STRESS_MODE`) accelera l'evoluzione verso le soglie critiche per la verifica degli eventi.

## 6. Validazione

`npm test` esegue **44 verifiche**: test automatici sul modello e sulle regole dei consumer, simulazioni parametriche per modalità di guida (120 cicli ≈ 4 minuti di simulazione), verifica della sostituzione fra componenti simulati e reali, e due suite end-to-end sull'interfaccia WoT — una via HTTP e una sul binding MQTT.

| Modalità | Efficienza (km/kWh) | Comportamento osservato |
|----------|---------------------|-------------------------|
| Save | 6,2 – 10,0 | massima efficienza, sistema stabile |
| Hybrid | 4,4 – 5,8 | funzionamento nominale bilanciato |
| Full Electric | 2,8 – 5,4 | scarica batteria più rapida |
| Sport | 2,9 – 5,1 | surriscaldamento e `criticalOverheat` attivato |

In `STRESS_MODE` la temperatura raggiunge la soglia massima (120 °C) attivando ripetutamente l'evento di surriscaldamento, mentre la scarica progressiva della batteria genera l'evento di bassa autonomia — a conferma della corretta propagazione dello stato dai sensori (Thing) ai consumer. In condizioni nominali non si osservano falsi positivi sugli eventi di anomalia.

La correttezza dell'interfaccia WoT (generazione della TD, lettura delle proprietà, invocazione delle azioni) è verificata end-to-end su **entrambi i binding**. La suite MQTT, eseguita con broker embedded e quindi senza alcuna dipendenza esterna, controlla la presenza della doppia form nelle Thing Description, l'uso del vocabolario `mqv:`, l'invocazione della medesima azione sui due protocolli e la ricezione di un evento sottoscritto via MQTT. La suite sulle sorgenti verifica inoltre che il gemello continui a rispondere alla scadenza delle misure reali e si riallinei automaticamente al ritorno del dispositivo.

## 7. Avvio

Il codice sorgente si trova nella cartella [`WoT-ProActiveDrive/`](./WoT-ProActiveDrive). Non è necessario installare alcun broker MQTT: se nessuno risponde, il runtime ne ospita uno embedded.

```bash
cd WoT-ProActiveDrive
npm install
npm run dev
```

- Thing WoT (HTTP): `http://localhost:8080/powerunit` · `/energystorage` · `/controlactuator`
- Thing WoT (MQTT): topic `PowerUnit/*` · `EnergyStorage/*` · `ControlActuator/*` su `mqtt://localhost:1883`
- Dashboard web (telemetria live, grafici, controllo guida/rigenerazione): `http://localhost:8091`

Per dimostrare la sostituzione di un componente simulato con uno fisico si dichiarano le parti reali all'avvio e si avvia l'emulatore del dispositivo in un secondo terminale:

```bash
REAL_COMPONENTS=energyStorage npm run dev    # terminale 1: il gemello
npm run device -- energyStorage              # terminale 2: il componente fisico
```

Alla connessione del dispositivo il SoH passa dal valore simulato (~96%) a quello misurato (~81%), il Diagnostic Tool segnala il degrado e, alla disconnessione, il gemello torna al modello senza interruzione di servizio.

Esempi di interazione:
```bash
# Lettura di una proprietà
curl http://localhost:8080/powerunit/properties/batterySoC

# Invocazione di un'azione
curl -X POST http://localhost:8080/controlactuator/actions/setDriveMode \
     -H "Content-Type: application/json" -d '"Sport"'
```

Esecuzione dei test: `npm test`

**Parametri di configurazione (variabili d'ambiente):** `MQTT_ENABLED=false` (solo HTTP) · `MQTT_SELF_HOST` (broker embedded se nessuno risponde) · `HTTP_PORT` · `DASHBOARD_PORT` · `MQTT_BROKER_URL` · `REAL_COMPONENTS` (componenti presenti come parte reale) · `DEVICE_STALENESS_MS` (finestra di validità delle misure reali) · `STRESS_MODE=true` (forza rapidamente le soglie critiche).

## 8. Limiti e sviluppi futuri

- **Modello fisico semplificato**: il simulatore è fenomenologico e non calibrato su dati sperimentali reali; un'estensione naturale è l'integrazione di dataset di veicoli reali o di un modello data-driven.
- **Sicurezza**: il prototipo adotta lo schema `nosec`; in un contesto di produzione andrebbero introdotti meccanismi di autenticazione/autorizzazione previsti dalla TD (es. OAuth2, token).
- **Controllo predittivo**: l'Energy Orchestrator implementa regole a soglia; un'evoluzione consiste nell'adozione di politiche predittive (es. MPC o apprendimento per rinforzo) per l'ottimizzazione energetica.
- **Persistenza e scalabilità**: lo storico è mantenuto su file locale; per scenari multi-veicolo sarebbe opportuno un time-series database.

## 9. Tecnologie

**Backend / Things**: Node.js · TypeScript · [node-wot](https://github.com/eclipse-thingweb/node-wot) (implementazione di riferimento W3C WoT)
**Comunicazione**: `@node-wot/binding-http` · `@node-wot/binding-mqtt` · aedes (broker MQTT embedded) · formato JSON
**Frontend**: HTML5 · CSS3 · JavaScript · Chart.js

## Riferimenti

- W3C, *Web of Things (WoT) Thing Description 1.1*, W3C Recommendation. https://www.w3.org/TR/wot-thing-description11/
- W3C, *Web of Things (WoT) Architecture*. https://www.w3.org/TR/wot-architecture/
- Eclipse Thingweb, *node-wot*. https://github.com/eclipse-thingweb/node-wot
- OASIS, *MQTT Version 5.0*. https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html


