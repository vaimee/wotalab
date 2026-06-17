/**
 * Application Entry Point
 * Smart Home Security System - Web of Things
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const mqtt = require('mqtt');
const { Aedes } = require('aedes');
const net = require('net');
const { WebSocketServer } = require('ws');

const DoorSensor = require('./things/doorSensor');
const WindowSensor = require('./things/windowSensor');
const MotionSensor = require('./things/motionSensor');
const AlarmSystem = require('./things/alarmSystem');
const NotificationService = require('./things/notificationService');
const Orchestrator = require('./orchestrator/orchestrator');

const app = express();
const HTTP_PORT = 3000;
const MQTT_PORT = 1883;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

console.log('\n' + '='.repeat(60));
console.log('Smart Home Security System - Web of Things');
console.log('='.repeat(60) + '\n');

// MQTT Broker Setup (Aedes)
let broker;
let mqttServer;
let mqttClient;
let doorSensor, windowSensor, motionSensor, alarmSystem, notificationService, orchestrator;

// broadcast viene definita dopo la creazione del server HTTP,
// ma le Things la ricevono solo dopo la connessione MQTT (che avviene dopo)
let broadcast = () => {};

function setupMqttClient(client) {
  client.on('connect', () => {
    console.log('✓ [MQTT Client] Connesso al broker');

    doorSensor = new DoorSensor(client);
    windowSensor = new WindowSensor(client);
    motionSensor = new MotionSensor(client);
    alarmSystem = new AlarmSystem(client, broadcast);
    notificationService = new NotificationService(client, broadcast);
    orchestrator = new Orchestrator(client, alarmSystem, notificationService, broadcast);
    
    console.log('✓ [System] Tutte le Things inizializzate');
    console.log('✓ [System] Orchestrator attivo\n');
  });

  client.on('error', (err) => {
    console.error('[MQTT Client] Errore di connessione:', err);
  });

  client.on('disconnect', () => {
    console.log('[MQTT Client] Disconnesso dal broker');
  });
}

async function startBroker() {
  broker = await Aedes.createBroker();
  mqttServer = net.createServer(broker.handle);

  mqttServer.listen(MQTT_PORT, () => {
    console.log(`✓ [MQTT Broker] In ascolto su porta ${MQTT_PORT}`);

    mqttClient = mqtt.connect(`mqtt://localhost:${MQTT_PORT}`);
    setupMqttClient(mqttClient);
  });

  broker.on('clientError', (client, err) => {
    console.error('[MQTT Broker] Client error:', client ? client.id : 'unknown', err);
  });

  broker.on('error', (err) => {
    console.error('[MQTT Broker] Errore:', err);
  });
}

startBroker().catch((err) => {
  console.error('[MQTT Broker] Avvio fallito:', err);
  process.exit(1);
});

// ==================== Utility Functions ====================

function ensureInitialized(res) {
  if (!doorSensor) {
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
      mqtt: mqttClient && mqttClient.connected ? 'connected' : 'disconnected',
      things_ready: !!doorSensor
    }
  });
});

// ==================== Thing Description Routes ====================

app.get('/things/door-sensor/td', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(doorSensor.getThingDescription());
});

app.get('/things/window-sensor/td', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(windowSensor.getThingDescription());
});

app.get('/things/motion-sensor/td', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(motionSensor.getThingDescription());
});

app.get('/things/alarm-system/td', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(alarmSystem.getThingDescription());
});

app.get('/things/notification-service/td', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(notificationService.getThingDescription());
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

app.get('/orchestrator/properties/securityMode', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json(orchestrator.getProperty('securityMode'));
});

// ==================== Orchestrator Actions ====================

app.post('/orchestrator/actions/activateSecurityMode', (req, res) => {
  if (!ensureInitialized(res)) return;
  orchestrator.activateSecurityMode();
  res.json({ result: 'Security mode activated', securityMode: true });
});

app.post('/orchestrator/actions/deactivateSecurityMode', (req, res) => {
  if (!ensureInitialized(res)) return;
  orchestrator.deactivateSecurityMode();
  res.json({ result: 'Security mode deactivated', securityMode: false });
});

// ==================== API Summary Routes ====================

app.get('/api/things', (req, res) => {
  if (!ensureInitialized(res)) return;
  res.json({
    things: [
      { id: 'door-sensor', title: 'Door Sensor', type: 'Sensor', uri: '/things/door-sensor/td' },
      { id: 'window-sensor', title: 'Window Sensor', type: 'Sensor', uri: '/things/window-sensor/td' },
      { id: 'motion-sensor', title: 'Motion Sensor', type: 'Sensor', uri: '/things/motion-sensor/td' },
      { id: 'alarm-system', title: 'Alarm System', type: 'Actuator', uri: '/things/alarm-system/td' },
      { id: 'notification-service', title: 'Notification Service', type: 'Service', uri: '/things/notification-service/td' }
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

broadcast = function(data) {
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
  });
  
  if (mqttClient) {
    mqttClient.end(() => {
      console.log('[MQTT Client] Disconnesso');
    });
  }
  
  mqttServer.close(() => {
    console.log('[MQTT Broker] Arrestato');
    broker.close(() => {
      process.exit(0);
    });
  });
  
  setTimeout(() => {
    console.error('[System] Arresto forzato');
    process.exit(1);
  }, 5000);
});

module.exports = app;