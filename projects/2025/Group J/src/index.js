/**
 * Application Entry Point
 * Smart Home Security System - Web of Things
 *
 * Architettura:
 * - ogni Thing (doorSensor, windowSensor, motionSensor, alarmSystem,
 *   notificationService) espone se stessa come vero WoT Producer (node-wot)
 *   su una porta HTTP dedicata, con TD generata da node-wot.
 * - getThingDescription() delle Thing è asincrono (l'esposizione WoT lo è),
 *   quindi le route che restituiscono la TD usano await.
 * - l'Orchestrator è un vero Consumer WoT: non riceve le istanze JS di
 *   alarmSystem/notificationService, ma solo gli URL delle loro TD reali.
 *   Le fa proprie con WoT.requestThingDescription() + WoT.consume() e parla
 *   con esse solo tramite invokeAction()/readProperty()/subscribeEvent().
 *   Le sue azioni (activateSecurityMode, ecc.) sono quindi asincrone e le
 *   relative route Express usano await.
 * - non c'è più alcun broker/client MQTT: era usato solo come canale di
 *   comunicazione legacy tra le Thing e l'Orchestrator, ora sostituito
 *   interamente da HTTP + WoT (TD reali, invokeAction/readProperty/
 *   subscribeEvent).
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

const app = express();
const HTTP_PORT = 3000;

// Porte HTTP dedicate a ciascuna Thing (ogni Thing è un Producer WoT
// indipendente, con il proprio endpoint generato da node-wot).
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

let doorSensor, windowSensor, motionSensor, alarmSystem, notificationService, orchestrator;

// broadcast viene sostituito con la funzione reale dopo l'avvio del
// WebSocketServer (più sotto). Le Thing/l'Orchestrator ricevono un piccolo
// proxy che inoltra sempre alla versione corrente di `broadcast`, così
// l'ordine di inizializzazione non è rilevante.
let broadcast = () => {};
const broadcastProxy = (data) => broadcast(data);

async function initSystem() {
  doorSensor = new DoorSensor({ httpPort: THING_PORTS.doorSensor });
  windowSensor = new WindowSensor({ httpPort: THING_PORTS.windowSensor });
  motionSensor = new MotionSensor({ httpPort: THING_PORTS.motionSensor });
  alarmSystem = new AlarmSystem(broadcastProxy, { httpPort: THING_PORTS.alarmSystem });
  notificationService = new NotificationService(broadcastProxy, { httpPort: THING_PORTS.notificationService });

  // Attende che ogni Thing abbia finito di esporsi come Producer WoT
  // (Servient + HTTP binding avviati, TD generata) prima di segnalarla pronta.
  await Promise.all([
    doorSensor.ready,
    windowSensor.ready,
    motionSensor.ready,
    alarmSystem.ready,
    notificationService.ready
  ]);

  console.log('✓ [System] Tutte le Things esposte come veri WoT Producer');

  // L'Orchestrator è un vero Consumer WoT: riceve solo gli URL delle TD
  // reali e le consuma con WoT.requestThingDescription() + WoT.consume().
  const THING_URLS = {
    doorSensor: `http://localhost:${THING_PORTS.doorSensor}/door-sensor`,
    windowSensor: `http://localhost:${THING_PORTS.windowSensor}/window-sensor`,
    motionSensor: `http://localhost:${THING_PORTS.motionSensor}/motion-sensor`,
    alarmSystem: `http://localhost:${THING_PORTS.alarmSystem}/alarm-system`,
    notificationService: `http://localhost:${THING_PORTS.notificationService}/notification-service`
  };

  orchestrator = new Orchestrator(THING_URLS, broadcastProxy);
  await orchestrator.ready;

  console.log('✓ [System] Orchestrator attivo come Consumer WoT\n');
}

initSystem().catch((err) => {
  console.error('[System] Avvio fallito:', err);
  process.exit(1);
});

// ==================== Utility Functions ====================

function ensureInitialized(res) {
  if (!doorSensor || !orchestrator) {
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
      things_ready: !!doorSensor,
      orchestrator_ready: !!orchestrator
    }
  });
});

// ==================== Thing Description Routes ====================
// Ora proxano la TD reale generata da node-wot (asincrona), invece del
// JSON statico di prima. Restano comunque raggiungibili da qui per comodità
// della dashboard; la TD "autorevole" resta comunque quella esposta
// direttamente dalla Thing sulla propria porta (es. http://localhost:3004/alarm-system).

app.get('/things/door-sensor/td', async (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(await doorSensor.getThingDescription());
});

app.get('/things/window-sensor/td', async (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(await windowSensor.getThingDescription());
});

app.get('/things/motion-sensor/td', async (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(await motionSensor.getThingDescription());
});

app.get('/things/alarm-system/td', async (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(await alarmSystem.getThingDescription());
});

app.get('/things/notification-service/td', async (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(await notificationService.getThingDescription());
});

// ==================== Door Sensor Properties ====================

app.get('/things/door-sensor/properties/isOpen', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(doorSensor.getProperty('isOpen'));
});

app.get('/things/door-sensor/properties/lastUpdate', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(doorSensor.getProperty('lastUpdate'));
});

app.get('/things/door-sensor/properties', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(doorSensor.getAllProperties());
});

// ==================== Window Sensor Properties ====================

app.get('/things/window-sensor/properties/isOpen', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(windowSensor.getProperty('isOpen'));
});

app.get('/things/window-sensor/properties/lastUpdate', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(windowSensor.getProperty('lastUpdate'));
});

app.get('/things/window-sensor/properties', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(windowSensor.getAllProperties());
});

// ==================== Motion Sensor Properties ====================

app.get('/things/motion-sensor/properties/motionDetected', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(motionSensor.getProperty('motionDetected'));
});

app.get('/things/motion-sensor/properties/lastUpdate', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(motionSensor.getProperty('lastUpdate'));
});

app.get('/things/motion-sensor/properties', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(motionSensor.getAllProperties());
});

// ==================== Alarm System Properties ====================

app.get('/things/alarm-system/properties/alarmStatus', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(alarmSystem.getProperty('alarmStatus'));
});

app.get('/things/alarm-system/properties', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(alarmSystem.getAllProperties());
});

// ==================== Manual Sensor Actions ====================

app.post('/things/door-sensor/actions/setOpen', (req, res) => {
  if (!ensureInitialized(res)) return;
  const { state } = req.body;
  if (typeof state !== 'boolean') {
    return res.status(400).json({ error: 'state must be a boolean' });
  }
  doorSensor.setOpen(state);
  res.json({ result: 'Door state updated', isOpen: state });
});

app.post('/things/window-sensor/actions/setOpen', (req, res) => {
  if (!ensureInitialized(res)) return;
  const { state } = req.body;
  if (typeof state !== 'boolean') {
    return res.status(400).json({ error: 'state must be a boolean' });
  }
  windowSensor.setOpen(state);
  res.json({ result: 'Window state updated', isOpen: state });
});

app.post('/things/motion-sensor/actions/setMotionDetected', (req, res) => {
  if (!ensureInitialized(res)) return;
  const { state } = req.body;
  if (typeof state !== 'boolean') {
    return res.status(400).json({ error: 'state must be a boolean' });
  }
  motionSensor.setMotionDetected(state);
  res.json({ result: 'Motion state updated', motionDetected: state });
});

// ==================== Alarm System Actions ====================

app.post('/things/alarm-system/actions/triggerAlarm', (req, res) => {
  if (!ensureInitialized(res)) return;
  alarmSystem.triggerAlarm();
  broadcast({ type: 'log', category: 'alert', message: '⚠️ Allarme attivato manualmente' });
  res.json({ result: 'Alarm triggered', alarmStatus: 'TRIGGERED' });
});

app.post('/things/alarm-system/actions/resetAlarm', (req, res) => {
  if (!ensureInitialized(res)) return;
  alarmSystem.resetAlarm();
  broadcast({ type: 'log', category: 'sensor', message: 'Allarme resettato' });
  res.json({ result: 'Alarm reset', alarmStatus: 'RESET' });
});

// ==================== Notification Service Actions ====================

app.post('/things/notification-service/actions/sendNotification', (req, res) => {
  if (!ensureInitialized(res)) return;
  const { message, severity = 'info' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  const notification = notificationService.sendNotification(message, severity);
  res.json({ result: 'Notification sent', notification });
});

// ==================== Orchestrator Properties ====================

app.get('/orchestrator/properties/securityMode', async (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(await orchestrator.getProperty('securityMode'));
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

app.get('/api/things', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json({
    things: [
      { id: 'door-sensor', title: 'Door Sensor', type: 'Sensor', uri: '/things/door-sensor/td', wotUri: `http://localhost:${THING_PORTS.doorSensor}/door-sensor` },
      { id: 'window-sensor', title: 'Window Sensor', type: 'Sensor', uri: '/things/window-sensor/td', wotUri: `http://localhost:${THING_PORTS.windowSensor}/window-sensor` },
      { id: 'motion-sensor', title: 'Motion Sensor', type: 'Sensor', uri: '/things/motion-sensor/td', wotUri: `http://localhost:${THING_PORTS.motionSensor}/motion-sensor` },
      { id: 'alarm-system', title: 'Alarm System', type: 'Actuator', uri: '/things/alarm-system/td', wotUri: `http://localhost:${THING_PORTS.alarmSystem}/alarm-system` },
      { id: 'notification-service', title: 'Notification Service', type: 'Service', uri: '/things/notification-service/td', wotUri: `http://localhost:${THING_PORTS.notificationService}/notification-service` }
    ]
  });
});

app.get('/api/status', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json({
    systemStatus: 'operational',
    securityMode: orchestrator.securityMode,
    alarmStatus: alarmSystem.alarmStatus,
    doorOpen: doorSensor.isOpen,
    windowOpen: windowSensor.isOpen,
    motionDetected: motionSensor.motionDetected,
    timestamp: new Date().toISOString()
  });
});

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
  console.log('\nServer avviato. Premi CTRL+C per arrestare.\n');
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