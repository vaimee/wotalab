/**
 * Orchestrator (Consumer)
 * Gestisce la logica applicativa e coordina le interazioni tra le Things
 */

class Orchestrator {
  constructor(mqttClient, alarmSystem, notificationService, broadcast) {
    this.mqttClient = mqttClient;
    this.alarmSystem = alarmSystem;
    this.notificationService = notificationService;
    this.broadcast = broadcast || (() => {});

    this.securityMode = false;
    this.alertHistory = [];

    this.subscribeToEvents();
  }

  subscribeToEvents() {
    if (!this.mqttClient) return;

    const doSubscribe = () => {
      this.mqttClient.subscribe('events/door-sensor/doorOpened', { qos: 1 });
      this.mqttClient.subscribe('events/window-sensor/windowOpened', { qos: 1 });
      this.mqttClient.subscribe('events/motion-sensor/motionDetected', { qos: 1 });
      console.log('[Orchestrator] Sottoscritto agli eventi dei sensori');
    };

    if (this.mqttClient.connected) {
      doSubscribe();
    } else {
      this.mqttClient.once('connect', doSubscribe);
    }

    this.mqttClient.on('message', (topic, message) => {
      this.handleEvent(topic, message);
    });
  }

  handleEvent(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      switch (topic) {
        case 'events/door-sensor/doorOpened':    this.handleDoorEvent(payload); break;
        case 'events/window-sensor/windowOpened': this.handleWindowEvent(payload); break;
        case 'events/motion-sensor/motionDetected': this.handleMotionEvent(payload); break;
      }
    } catch (err) {
      console.error('[Orchestrator] Errore elaborazione evento:', err);
    }
  }

  handleDoorEvent(payload) {
    const label = payload.isOpen ? 'aperta' : 'chiusa';
    console.log(`[Orchestrator] Evento: Porta ${label}`);
    if (this.securityMode && payload.isOpen) {
      this.triggerSecurityAlert('Porta aperta', 'critical');
    } else {
      this.broadcast({ type: 'log', category: 'sensor', message: `Porta ${label}` });
    }
  }

  handleWindowEvent(payload) {
    const label = payload.isOpen ? 'aperta' : 'chiusa';
    console.log(`[Orchestrator] Evento: Finestra ${label}`);
    if (this.securityMode && payload.isOpen) {
      this.triggerSecurityAlert('Finestra aperta', 'critical');
    } else {
      this.broadcast({ type: 'log', category: 'sensor', message: `Finestra ${label}` });
    }
  }

  handleMotionEvent(payload) {
    const label = payload.motionDetected ? 'rilevato' : 'cessato';
    console.log(`[Orchestrator] Evento: Movimento ${label}`);
    if (this.securityMode && payload.motionDetected) {
      this.triggerSecurityAlert('Movimento rilevato', 'warning');
    } else {
      this.broadcast({ type: 'log', category: 'sensor', message: `Movimento ${label}` });
    }
  }

  triggerSecurityAlert(message, severity = 'warning') {
    const alert = { timestamp: new Date().toISOString(), message, severity };
    this.alertHistory.push(alert);
    this.alarmSystem.triggerAlarm();
    this.notificationService.sendNotification(message, severity);
    console.log(`[Orchestrator] ALERTA DI SICUREZZA: ${message}`);
    this.broadcast({ type: 'log', category: 'alert', message: `⚠️ ${message} — allarme attivato, notifica inviata` });
  }

  activateSecurityMode() {
    this.securityMode = true;
    console.log('[Orchestrator] Modalità Sicurezza ATTIVATA');
    this.notificationService.sendNotification('Modalità Sicurezza attivata - Away Mode', 'info');
    this.broadcast({ type: 'log', category: 'sensor', message: 'Modalità Sicurezza attivata' });
  }

  deactivateSecurityMode() {
    this.securityMode = false;
    this.alarmSystem.resetAlarm();
    console.log('[Orchestrator] Modalità Sicurezza DISATTIVATA');
    this.notificationService.sendNotification('Modalità Sicurezza disattivata', 'info');
    this.broadcast({ type: 'log', category: 'sensor', message: 'Modalità Sicurezza disattivata — allarme resettato' });
  }

  getProperty(propName) {
    if (propName === 'securityMode') return { value: this.securityMode };
    return null;
  }

  getAlertHistory(limit = 10) { return this.alertHistory.slice(-limit); }
  clearAlertHistory() { this.alertHistory = []; }
}

module.exports = Orchestrator;