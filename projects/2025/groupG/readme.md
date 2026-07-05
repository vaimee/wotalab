# Membri del gruppo

Matteo Manganiello (matteo.manganiello@studio.unibo.it)

# WoT-ProActiveDrive

**Digital Twin** di un propulsore ibrido (motore termico + motore elettrico + batteria) realizzato con lo standard **W3C Web of Things (WoT)**.
Il sistema simula il powertrain in tempo reale, espone i dati tramite Thing Description e permette il controllo remoto da una dashboard web.

## Architettura

Tre **Thing** WoT, ciascuna con la propria Thing Description auto-descrittiva:

| Thing | Ruolo | Espone |
|-------|-------|--------|
| **PowerUnit** | Motore ibrido | SoC, RPM, coppia, temperatura, efficienza, autonomia + azioni e allarmi |
| **EnergyStorage** | Pacco batteria | SoC, SoH, tensione, corrente, temperatura |
| **ControlActuator** | Controllo propulsione | Modalità di guida e frenata rigenerativa |

- **HTTP** → espone le Thing Description, la lettura delle proprietà e le azioni di comando.
- **MQTT** → pubblica la telemetria in streaming sul topic `wot/proactivedrive/telemetry` (opzionale; se il broker non è raggiungibile il sistema parte in modalità HTTP-only).
- Un **Diagnostic Tool** (consumer WoT) legge le proprietà via HTTP e segnala rischi (surriscaldamento, degrado batteria, autonomia bassa).

**Azioni:** `setDriveMode` (Full Electric / Hybrid / Sport / Save) · `triggerRegen` (intensità 1–3)
**Eventi:** `criticalOverheat` · `lowEnergyWarning` · `anomalyDetected`

## Avvio

```bash
npm install
npm run dev
```

- Thing WoT (HTTP): `http://localhost:8080/powerunit` · `/energystorage` · `/controlactuator`
- Dashboard web (telemetria live, grafici, controllo guida/rigenerazione): `http://localhost:8091`

Esempi:
```bash
curl http://localhost:8080/powerunit/properties/batterySoC
curl -X POST http://localhost:8080/controlactuator/actions/setDriveMode \
     -H "Content-Type: application/json" -d '"Sport"'
```

Test: `npm test`

**Variabili opzionali:** `MQTT_ENABLED=false` (solo HTTP) · `HTTP_PORT` · `DASHBOARD_PORT` · `MQTT_BROKER_URL` · `STRESS_MODE=true` (forza rapidamente soglie critiche ed eventi).

## Tecnologie

Node.js · TypeScript · [node-wot](https://github.com/eclipse-thingweb/node-wot) (W3C WoT) · MQTT · HTML/CSS/JS con Chart.js per la dashboard.

