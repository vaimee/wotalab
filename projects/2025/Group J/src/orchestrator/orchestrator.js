/**
 * Orchestrator (Consumer WoT)
 * Gestisce la logica applicativa e coordina le interazioni tra le Things.
 *
 * L'Orchestrator non riceve le Thing come istanze JavaScript da chiamare
 * direttamente (this.alarmSystem.triggerAlarm()), né URL hardcoded delle
 * loro TD. Scopre le Thing interrogando la Thing Directory (WoT Discovery):
 *  1. GET {directoryUrl}/things -> elenco delle TD reali autoregistrate
 *  2. WoT.consume(td) su ciascuna TD trovata, ottenendo un ConsumedThing
 *  3. interagisce SOLO tramite invokeAction() / readProperty() / subscribeEvent(),
 *     cioè tramite ciò che la TD dichiara — non tramite conoscenza diretta
 *     dell'implementazione della Thing.
 *
 * Il trasporto usato (HTTP, con eventi via long-polling) è quello dichiarato
 * nei forms della TD: l'Orchestrator non lo sceglie né lo conosce a priori,
 * lo scopre leggendo la TD.
 */

const { Servient } = require('@node-wot/core');
const { HttpClientFactory } = require('@node-wot/binding-http');

// Titoli delle Thing come dichiarati nelle rispettive TD: usati per
// riconoscere quale TD scoperta nella Directory corrisponde a quale ruolo
// applicativo, senza fare assunzioni su URL o porte.
const THING_TITLES = {
  doorSensor: 'Door Sensor',
  windowSensor: 'Window Sensor',
  motionSensor: 'Motion Sensor',
  alarmSystem: 'Alarm System',
  notificationService: 'Notification Service'
};

class Orchestrator {
  /**
   * @param {string} directoryUrl - URL base della Thing Directory da interrogare per la discovery
   * @param {function} broadcast - callback verso i client WebSocket della dashboard
   */
  constructor(directoryUrl, broadcast) {
    this.directoryUrl = directoryUrl;
    this.broadcast = broadcast || (() => {});

    this.securityMode = false;
    this.alertHistory = [];
    this.consumedThings = {};

    this.ready = this._init();
  }

  async _init() {
    this.servient = new Servient();
    this.servient.addClientFactory(new HttpClientFactory());
    this.WoT = await this.servient.start();

    const discoveredTDs = await this._discoverThings();

    this.consumedThings.doorSensor = await this._consumeByTitle(discoveredTDs, THING_TITLES.doorSensor);
    this.consumedThings.windowSensor = await this._consumeByTitle(discoveredTDs, THING_TITLES.windowSensor);
    this.consumedThings.motionSensor = await this._consumeByTitle(discoveredTDs, THING_TITLES.motionSensor);
    this.consumedThings.alarmSystem = await this._consumeByTitle(discoveredTDs, THING_TITLES.alarmSystem);
    this.consumedThings.notificationService = await this._consumeByTitle(
      discoveredTDs,
      THING_TITLES.notificationService
    );

    await this._subscribeToEvents();

    console.log('[Orchestrator] Thing scoperte via Thing Directory e consumate, sottoscritto agli eventi dei sensori');
  }

  /** Interroga la Thing Directory e ritorna tutte le TD registrate. */
  async _discoverThings() {
    const res = await fetch(`${this.directoryUrl}/things`);
    if (!res.ok) {
      throw new Error(`[Orchestrator] Discovery fallita: la Thing Directory ha risposto ${res.status}`);
    }
    return res.json();
  }

  async _consumeByTitle(discoveredTDs, title) {
    const td = discoveredTDs.find((t) => t.title === title);
    if (!td) {
      throw new Error(`[Orchestrator] Nessuna Thing con title "${title}" trovata nella Thing Directory`);
    }
    return this.WoT.consume(td);
  }

  async _subscribeToEvents() {
    await this.consumedThings.doorSensor.subscribeEvent('doorOpened', async (data) => {
      this.handleDoorEvent(await data.value());
    });

    await this.consumedThings.windowSensor.subscribeEvent('windowOpened', async (data) => {
      this.handleWindowEvent(await data.value());
    });

    await this.consumedThings.motionSensor.subscribeEvent('motionDetected', async (data) => {
      this.handleMotionEvent(await data.value());
    });
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

  async triggerSecurityAlert(message, severity = 'warning') {
    const alert = { timestamp: new Date().toISOString(), message, severity };
    this.alertHistory.push(alert);

    await this.consumedThings.alarmSystem.invokeAction('triggerAlarm');
    await this.consumedThings.notificationService.invokeAction('sendNotification', { message, severity });

    console.log(`[Orchestrator] ALLERTA DI SICUREZZA: ${message}`);
    this.broadcast({ type: 'log', category: 'alert', message: `⚠️ ${message} — allarme attivato, notifica inviata` });
  }

  async activateSecurityMode() {
    this.securityMode = true;
    console.log('[Orchestrator] Modalità Sicurezza ATTIVATA');
    await this.consumedThings.notificationService.invokeAction('sendNotification', {
      message: 'Modalità Sicurezza attivata - Away Mode',
      severity: 'info'
    });
    this.broadcast({ type: 'log', category: 'sensor', message: 'Modalità Sicurezza attivata' });
  }

  async deactivateSecurityMode() {
    this.securityMode = false;
    await this.consumedThings.alarmSystem.invokeAction('resetAlarm');
    console.log('[Orchestrator] Modalità Sicurezza DISATTIVATA');
    await this.consumedThings.notificationService.invokeAction('sendNotification', {
      message: 'Modalità Sicurezza disattivata',
      severity: 'info'
    });
    this.broadcast({ type: 'log', category: 'sensor', message: 'Modalità Sicurezza disattivata — allarme resettato' });
  }

  getProperty(propName) {
    if (propName === 'securityMode') return { value: this.securityMode };
    return null;
  }

  getAlertHistory(limit = 10) {
    return this.alertHistory.slice(-limit);
  }

  clearAlertHistory() {
    this.alertHistory = [];
  }
}

module.exports = Orchestrator;