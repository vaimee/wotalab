/**
 * Application Entry Point
 * Smart Home Security System - Web of Things
 *
 * Architettura:
 * - ogni Thing è un vero Producer WoT (node-wot), esposta su una porta HTTP
 *   dedicata con una TD generata realmente da ciò che la Thing sa fare, e si
 *   autoregistra in una Thing Directory (meccanismo di discovery WoT).
 * - la Thing Directory (porta 3009) è l'unico punto in cui Orchestrator e
 *   dashboard scoprono le Thing: nessun URL di Thing è più hardcoded.
 * - l'Orchestrator è un vero Consumer WoT: scopre le TD tramite la Directory,
 *   le consuma (WoT.consume) e interagisce esclusivamente tramite
 *   invokeAction/readProperty/subscribeEvent.
 * - questo server (porta 3000) NON espone più un proxy REST manuale
 *   parallelo alle Thing: quello era il problema originale (doppia
 *   implementazione, dashboard che non consumava le TD reali). Espone solo
 *   endpoint che non duplicano interazioni già dichiarate in una TD:
 *   health check, azioni/proprietà dell'Orchestrator (che non è una Thing)
 *   e cronologia (alert/notifiche) per la dashboard.
 * - la dashboard (public/index.html) consuma direttamente le Thing reali:
 *   scopre le TD dalla Directory e usa gli href dichiarati nelle forms per
 *   leggere property e invocare action, esattamente come farebbe un
 *   qualunque Consumer WoT.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');

const DoorSensor = require('./things/doorSensor');
const WindowSensor = require('./things/windowSensor');
const MotionSensor = require('./things/motionSensor');
const AlarmSystem = require('./things/alarmSystem');
const NotificationService = require('./things/notificationService');
const Orchestrator = require('./orchestrator/orchestrator');
const ThingDirectory = require('./directory/thingDirectory');

const app = express();
const HTTP_PORT = 3000;
const DIRECTORY_PORT = 3009;

// Porte HTTP dedicate a ciascuna Thing (ognuna è un Producer WoT indipendente,
// con il proprio endpoint generato da node-wot).
const THING_PORTS = {
  doorSensor: 3001,
  windowSensor: 3002,
  motionSensor: 3003,
  alarmSystem: 3004,
  notificationService: 3005
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

console.log('\n' + '='.repeat(60));
console.log('Smart Home Security System - Web of Things');
console.log('='.repeat(60) + '\n');

let directory, doorSensor, windowSensor, motionSensor, alarmSystem, notificationService, orchestrator;
let systemReady = false;

let broadcast = () => {};

async function startSystem() {
  // La Thing Directory deve essere già in ascolto prima che le Thing
  // provino ad autoregistrarsi.
  directory = new ThingDirectory({ port: DIRECTORY_PORT });
  await directory.ready;
  const directoryUrl = `http://localhost:${DIRECTORY_PORT}`;

  doorSensor = new DoorSensor({ httpPort: THING_PORTS.doorSensor, directoryUrl });
  windowSensor = new WindowSensor({ httpPort: THING_PORTS.windowSensor, directoryUrl });
  motionSensor = new MotionSensor({ httpPort: THING_PORTS.motionSensor, directoryUrl });
  alarmSystem = new AlarmSystem(broadcast, { httpPort: THING_PORTS.alarmSystem, directoryUrl });
  notificationService = new NotificationService(broadcast, {
    httpPort: THING_PORTS.notificationService,
    directoryUrl
  });

  // Attende che ogni Thing abbia finito di esporsi come Producer WoT
  // (Servient + HTTP binding avviati, TD generata) E di autoregistrarsi
  // nella Thing Directory.
  await Promise.all([
    doorSensor.ready,
    windowSensor.ready,
    motionSensor.ready,
    alarmSystem.ready,
    notificationService.ready
  ]);

  console.log('✓ [System] Tutte le Things esposte come veri WoT Producer e registrate nella Thing Directory');

  // L'Orchestrator è un vero Consumer WoT: scopre le TD interrogando la
  // Thing Directory (nessun URL hardcoded), le consuma con WoT.consume e
  // interagisce solo tramite invokeAction/readProperty/subscribeEvent.
  orchestrator = new Orchestrator(directoryUrl, broadcast);
  await orchestrator.ready;

  systemReady = true;
  console.log('✓ [System] Orchestrator attivo come Consumer WoT (discovery via Thing Directory)\n');
}

// ==================== Utility Functions ====================

function ensureInitialized(res) {
  if (!systemReady) {
    res.status(503).json({ error: 'Service not ready' });
    return false;
  }
  return true;
}

// ==================== HTTP Routes ====================

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      things_ready: systemReady
    }
  });
});

// ==================== Orchestrator Properties ====================
// Nota: qui sotto NON ci sono più route "/things/*". Ogni Thing è già
// raggiungibile direttamente sulla propria porta HTTP con la propria TD
// autogenerata da node-wot (es. http://localhost:3001/door-sensor), e
// scopribile tramite la Thing Directory (http://localhost:3009/things).
// Riesporle qui sotto un'altra URL sarebbe di nuovo la doppia
// implementazione che si voleva eliminare. L'Orchestrator invece NON è una
// Thing (non ha una propria TD, per scelta di progetto — vedi
// ontology.jsonld, classe proj:Consumer), quindi le sue property/action
// restano legittimamente qui.

app.get('/orchestrator/properties/securityMode', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(orchestrator.getProperty('securityMode'));
});

// ==================== Orchestrator Actions ====================

app.post('/orchestrator/actions/activateSecurityMode', async (req, res) => {
  if (!ensureInitialized(res)) return;
  await orchestrator.activateSecurityMode();
  res.json({ result: 'Security mode activated', securityMode: true });
});

app.post('/orchestrator/actions/deactivateSecurityMode', async (req, res) => {
  if (!ensureInitialized(res)) return;
  await orchestrator.deactivateSecurityMode();
  res.json({ result: 'Security mode deactivated', securityMode: false });
});

// ==================== API Summary Routes ====================
// La lista delle Thing e lo stato delle loro property non si trovano più
// qui: la dashboard li ottiene scoprendo le Thing dalla Thing Directory
// (GET http://localhost:3009/things) e leggendo le property direttamente
// dagli href dichiarati nelle rispettive TD. Qui restano solo cronologie
// applicative (alert/notifiche) che non sono interaction affordance
// dichiarate in nessuna TD.

app.get('/api/alerts', (req, res) => {
  if (!ensureInitialized(res)) return;
  const limit = req.query.limit || 10;
  res.json({
    alerts: orchestrator.getAlertHistory(limit),
    total: orchestrator.alertHistory.length
  });
});

app.get('/api/notifications', (req, res) => {
  if (!ensureInitialized(res)) return;
  const limit = req.query.limit || 10;
  res.json({
    notifications: notificationService.getNotifications(limit),
    total: notificationService.notifications.length
  });
});

// ==================== Error Handling ====================

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ==================== Server Startup ====================

const server = app.listen(HTTP_PORT, () => {
  console.log(`✓ [HTTP Server] In ascolto su http://localhost:${HTTP_PORT}`);
  console.log(`✓ [Dashboard] Accessibile su http://localhost:${HTTP_PORT}`);
});

// ==================== WebSocket Server ====================

const wss = new WebSocketServer({ server });

broadcast = function (data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
};

wss.on('connection', (ws) => {
  console.log('[WS] Client connesso');
  ws.send(JSON.stringify({ type: 'connection', message: 'Connesso al server' }));
});

// Avvia le Thing e l'Orchestrator solo ora, dopo che `broadcast` è stato
// assegnato alla funzione reale: così alarmSystem/notificationService
// vengono costruiti con il broadcast vero, non con il placeholder no-op.
startSystem()
  .then(() => {
    console.log('Server avviato. Premi CTRL+C per arrestare.\n');
  })
  .catch((err) => {
    console.error('[System] Avvio fallito:', err);
    process.exit(1);
  });

// ==================== Graceful Shutdown ====================

process.on('SIGINT', () => {
  console.log('\n[System] Arresto in corso...');
  server.close(() => {
    console.log('[HTTP Server] Arrestato');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[System] Arresto forzato');
    process.exit(1);
  }, 5000);
});

module.exports = app;