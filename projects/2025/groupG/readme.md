# Membri del gruppo

Matteo Manganiello (matteo.manganiello@studio.unibo.it)

# WoT-ProActiveDrive
### Digital Twin di un propulsore ibrido basato su W3C Web of Things

## Sommario

Il progetto propone un **Digital Twin** di un propulsore ibrido (motore a combustione interna + motore elettrico + pacco batteria) realizzato secondo lo standard **W3C Web of Things (WoT)**. Il sistema simula in tempo reale la dinamica del powertrain, ne espone lo stato attraverso *Thing Description* interoperabili e ne consente il controllo remoto tramite una dashboard web. L'obiettivo è dimostrare come i principi del Web of Things — descrizione semantica dei dispositivi, disaccoppiamento dei protocolli e interazione uniforme — possano essere applicati a un caso d'uso di *proactive maintenance* e gestione energetica nell'ambito automotive.

## 1. Introduzione e motivazione

I veicoli ibridi ed elettrici generano grandi volumi di dati eterogenei (parametri termici, elettrici e meccanici) provenienti da sottosistemi diversi. L'assenza di uno strato di descrizione comune rende difficile l'integrazione, il monitoraggio e la manutenzione predittiva. Il **Web of Things** affronta questo problema di frammentazione introducendo un modello di astrazione basato sul Web: ogni dispositivo (*Thing*) è descritto da un documento formale (*Thing Description*) che ne dichiara capacità e modalità di accesso, indipendentemente dal protocollo di trasporto sottostante.

In questo contesto il progetto realizza un **gemello digitale** che:
- riproduce il comportamento fisico del propulsore tramite un modello di simulazione;
- rende osservabili le grandezze di interesse come *interaction affordances* WoT;
- attua politiche di controllo e diagnostica reattiva basate su soglie.

## 2. Obiettivi

1. **Interoperabilità** — modellare il propulsore come insieme di *Thing* WoT auto-descrittive, conformi alla Thing Description del W3C.
2. **Monitoraggio in tempo reale** — esporre telemetria continua (stato di carica, temperatura, efficienza, autonomia) e visualizzarla in una dashboard.
3. **Manutenzione proattiva** — rilevare e notificare condizioni di rischio (surriscaldamento, degrado batteria, bassa autonomia, anomalie di efficienza) mediante *eventi* asincroni.
4. **Controllo remoto** — permettere il cambio di modalità di guida e la gestione della frenata rigenerativa tramite *azioni*.
5. **Disaccoppiamento dei protocolli** — usare HTTP per interazioni sincrone (lettura/comando) e MQTT per lo streaming di telemetria, con degradazione controllata in assenza del broker.

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

**Consumer WoT**
- **Diagnostic Tool** — legge periodicamente le proprietà via HTTP e segnala i rischi (surriscaldamento, degrado del SoH, autonomia bassa) applicando soglie diagnostiche.
- **Predictive Dashboard** — interfaccia web che interroga via HTTP le proprietà di *PowerUnit* e *ControlActuator*, ne mostra l'andamento storico e invia i comandi di controllo.
- **Energy Orchestrator** — consumer di riferimento per la gestione automatica della coppia (incluso a scopo architetturale; disattivato in favore del controllo manuale da dashboard).

**Comunicazione**
- **HTTP** (sincrono, request/response) → espone le Thing Description, la lettura delle proprietà e l'invocazione delle azioni.
- **MQTT** (asincrono, publish/subscribe) → pubblica la telemetria in streaming sul topic `wot/proactivedrive/telemetry`. Il broker è **opzionale**: se non raggiungibile, il sistema effettua un *fallback* automatico in modalità HTTP-only, garantendo la continuità del servizio.

## 5. Modello di simulazione

Il gemello digitale è guidato da un modello a tempo discreto (passo di 2 s) che, ad ogni ciclo, aggiorna in modo accoppiato le seguenti grandezze:

- **Cinematica**: velocità con andamento sinusoidale modulato dalla modalità di guida (offset per Sport / Full Electric).
- **Coppia e regime motore**: funzione della domanda di velocità e della modalità; determinano lo stato del motore termico (`Off` / `Idle` / `Running`).
- **Bilancio energetico della batteria**: consumo dipendente da modalità, domanda e stato di carica, con recupero da **frenata rigenerativa** in fase di decelerazione.
- **Modello termico**: riscaldamento per carico/velocità/Sport, raffreddamento per flusso d'aria e rigenerazione; da esso derivano `thermalHealth` e l'usura (`SoH`) della batteria.
- **Efficienza di sistema**: efficienza istantanea (km/kWh) filtrata con una media mobile esponenziale (EMA), per riflettere il consumo reale evitando transitori all'avvio.

Le modalità di guida (`Full Electric`, `Hybrid`, `Sport`, `Save`) e l'intensità di rigenerazione (1–3) costituiscono le variabili di controllo esposte tramite azioni. Una modalità di *stress* (`STRESS_MODE`) accelera l'evoluzione verso le soglie critiche per la verifica degli eventi.

## 6. Validazione

Il comportamento del modello è stato verificato sia con test automatici sia con simulazioni parametriche per modalità di guida (120 cicli ≈ 4 minuti di simulazione):

| Modalità | Efficienza (km/kWh) | Comportamento osservato |
|----------|---------------------|-------------------------|
| Save | 6,2 – 10,0 | massima efficienza, sistema stabile |
| Hybrid | 4,4 – 5,8 | funzionamento nominale bilanciato |
| Full Electric | 2,8 – 5,4 | scarica batteria più rapida |
| Sport | 2,9 – 5,1 | surriscaldamento e `criticalOverheat` attivato |

In `STRESS_MODE` la temperatura raggiunge la soglia massima (120 °C) attivando ripetutamente l'evento di surriscaldamento, mentre la scarica progressiva della batteria genera l'evento di bassa autonomia — a conferma della corretta propagazione dello stato dai sensori (Thing) ai consumer. In condizioni nominali non si osservano falsi positivi sugli eventi di anomalia. La correttezza dell'interfaccia WoT (lettura proprietà, invocazione azioni, generazione TD) è verificata end-to-end via HTTP.

## 7. Avvio

```bash
npm install
npm run dev
```

- Thing WoT (HTTP): `http://localhost:8080/powerunit` · `/energystorage` · `/controlactuator`
- Dashboard web (telemetria live, grafici, controllo guida/rigenerazione): `http://localhost:8091`

Esempi di interazione:
```bash
# Lettura di una proprietà
curl http://localhost:8080/powerunit/properties/batterySoC

# Invocazione di un'azione
curl -X POST http://localhost:8080/controlactuator/actions/setDriveMode \
     -H "Content-Type: application/json" -d '"Sport"'
```

Esecuzione dei test: `npm test`

**Parametri di configurazione (variabili d'ambiente):** `MQTT_ENABLED=false` (solo HTTP) · `HTTP_PORT` · `DASHBOARD_PORT` · `MQTT_BROKER_URL` · `STRESS_MODE=true` (forza rapidamente le soglie critiche).

## 8. Limiti e sviluppi futuri

- **Modello fisico semplificato**: il simulatore è fenomenologico e non calibrato su dati sperimentali reali; un'estensione naturale è l'integrazione di dataset di veicoli reali o di un modello data-driven.
- **Sicurezza**: il prototipo adotta lo schema `nosec`; in un contesto di produzione andrebbero introdotti meccanismi di autenticazione/autorizzazione previsti dalla TD (es. OAuth2, token).
- **Controllo predittivo**: l'Energy Orchestrator implementa regole a soglia; un'evoluzione consiste nell'adozione di politiche predittive (es. MPC o apprendimento per rinforzo) per l'ottimizzazione energetica.
- **Persistenza e scalabilità**: lo storico è mantenuto su file locale; per scenari multi-veicolo sarebbe opportuno un time-series database.

## 9. Tecnologie

**Backend / Things**: Node.js · TypeScript · [node-wot](https://github.com/eclipse-thingweb/node-wot) (implementazione di riferimento W3C WoT)
**Comunicazione**: HTTP · MQTT (formato JSON)
**Frontend**: HTML5 · CSS3 · JavaScript · Chart.js

## Riferimenti

- W3C, *Web of Things (WoT) Thing Description 1.1*, W3C Recommendation. https://www.w3.org/TR/wot-thing-description11/
- W3C, *Web of Things (WoT) Architecture*. https://www.w3.org/TR/wot-architecture/
- Eclipse Thingweb, *node-wot*. https://github.com/eclipse-thingweb/node-wot
- OASIS, *MQTT Version 5.0*. https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html


