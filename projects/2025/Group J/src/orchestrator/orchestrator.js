/**
 * Orchestrator (Consumer WoT)
 * Gestisce la logica applicativa e coordina le interazioni tra le Things.
 *
 * Differenza fondamentale rispetto alla versione precedente: l'Orchestrator
 * non riceve più le Thing come istanze JavaScript da chiamare direttamente
 * (this.alarmSystem.triggerAlarm()). Riceve solo gli URL delle loro Thing
 * Description, e:
 *  1. scarica ciascuna TD con WoT.requestThingDescription(url)
 *  2. la consuma con WoT.consume(td), ottenendo un ConsumedThing
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

class Orchestrator {
  /**
   * @param {object} thingUrls - URL delle TD delle Thing da consumare
   *   { doorSensor, windowSensor, motionSensor, alarmSystem, notificationService }
   * @param {function} broadcast - callback verso i client WebSocket della dashboard
   */
  constructor(thingUrls, broadcast) {
    this.thingUrls = thingUrls;
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

    this.consumedThings.doorSensor = await this._consume(this.thingUrls.doorSensor);
    this.consumedThings.windowSensor = await this._consume(this.thingUrls.windowSensor);
    this.consumedThings.motionSensor = await this._consume(this.thingUrls.motionSensor);
    this.consumedThings.alarmSystem = await this._consume(this.thingUrls.alarmSystem);
    this.consumedThings.notificationService = await this._consume(this.thingUrls.notificationService);

    await this._subscribeToEvents();

    console.log('[Orchestrator] Tutte le TD consumate, sottoscritto agli eventi dei sensori');
  }

  async _consume(url) {
    const td = await this.WoT.requestThingDescription(url);
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