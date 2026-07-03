/**
 * Orchestrator (Consumer WoT)
 * Gestisce la logica applicativa e coordina le interazioni tra le Things
 *
 * Refactor rispetto alla versione precedente:
 * - non riceve più alarmSystem/notificationService come istanze JS: riceve
 *   solo gli URL delle Thing Description reali esposte dai relativi
 *   Producer (node-wot + HTTP binding), es. http://localhost:3004/alarm-system.
 * - all'avvio fa WoT.requestThingDescription(url) per ciascuna Thing e poi
 *   WoT.consume(td), ottenendo un ConsumedThing per ognuna.
 * - non chiama più metodi JS diretti (triggerAlarm(), sendNotification(), ...)
 *   né si iscrive a topic MQTT hardcoded: interagisce con le Thing SOLO
 *   tramite le primitive standard del Consumer WoT:
 *     - invokeAction(actionName, input)
 *     - readProperty(propName)
 *     - subscribeEvent(eventName, handler)
 * - la logica applicativa (quando scattare un allarme, cosa loggare sulla
 *   dashboard, ecc.) resta identica: cambia solo COME l'Orchestrator parla
 *   con le altre Thing.
 */

const { Servient } = require('@node-wot/core');
const { HttpClientFactory } = require('@node-wot/binding-http');

class Orchestrator {
  /**
   * @param {object} thingUrls - URL delle TD reali esposte dai Producer WoT
   *   {
   *     doorSensor: 'http://localhost:3001/door-sensor',
   *     windowSensor: 'http://localhost:3002/window-sensor',
   *     motionSensor: 'http://localhost:3003/motion-sensor',
   *     alarmSystem: 'http://localhost:3004/alarm-system',
   *     notificationService: 'http://localhost:3005/notification-service'
   *   }
   * @param {function} broadcast - callback verso i client WebSocket della dashboard
   */
  constructor(thingUrls, broadcast) {
    this.thingUrls = thingUrls;
    this.broadcast = broadcast || (() => {});

    this.securityMode = false;
    this.alertHistory = [];

    // ConsumedThing (proxy WoT) per ciascuna Thing remota, popolati da _init()
    this.doorSensor = null;
    this.windowSensor = null;
    this.motionSensor = null;
    this.alarmSystem = null;
    this.notificationService = null;

    // Come per le Thing (Producer), anche qui l'inizializzazione è asincrona:
    // richiede TD via rete e consuma i risultati prima di essere operativo.
    this.ready = this._init();
  }

  async _init() {
    // Il proprio Servient serve solo lato client: nessun server/porta HTTP,
    // solo la client factory necessaria a fare richieste verso le altre Thing.
    this.servient = new Servient();
    this.servient.addClientFactory(new HttpClientFactory());
    this.WoT = await this.servient.start();

    console.log('[Orchestrator] Consumer WoT avviato, richiedo le Thing Description...');

    const [doorTD, windowTD, motionTD, alarmTD, notificationTD] = await Promise.all([
      this.WoT.requestThingDescription(this.thingUrls.doorSensor),
      this.WoT.requestThingDescription(this.thingUrls.windowSensor),
      this.WoT.requestThingDescription(this.thingUrls.motionSensor),
      this.WoT.requestThingDescription(this.thingUrls.alarmSystem),
      this.WoT.requestThingDescription(this.thingUrls.notificationService)
    ]);

    this.doorSensor = await this.WoT.consume(doorTD);
    this.windowSensor = await this.WoT.consume(windowTD);
    this.motionSensor = await this.WoT.consume(motionTD);
    this.alarmSystem = await this.WoT.consume(alarmTD);
    this.notificationService = await this.WoT.consume(notificationTD);

    console.log('[Orchestrator] Tutte le Thing Description sono state consumate');

    await this._subscribeToEvents();

    console.log('[Orchestrator] Sottoscritto agli eventi WoT dei sensori (subscribeEvent)');
  }

  async _subscribeToEvents() {
    // Sostituisce le subscribe MQTT su topic hardcoded: ci iscriviamo agli
    // eventi dichiarati nella TD di ciascun sensore.
    await this.doorSensor.subscribeEvent('doorOpened', async (data) => {
      const payload = await data.value();
      this.handleDoorEvent(payload);
    });

    await this.windowSensor.subscribeEvent('windowOpened', async (data) => {
      const payload = await data.value();
      this.handleWindowEvent(payload);
    });

    await this.motionSensor.subscribeEvent('motionDetected', async (data) => {
      const payload = await data.value();
      this.handleMotionEvent(payload);
    });
  }

  // ---- Gestione eventi (logica applicativa invariata) ----

  handleDoorEvent(payload) {
    const label = payload.isOpen ? 'aperta' : 'chiusa';
    console.log(`[Orchestrator] Evento WoT: Porta ${label}`);
    if (this.securityMode && payload.isOpen) {
      this.triggerSecurityAlert('Porta aperta', 'critical');
    } else {
      this.broadcast({ type: 'log', category: 'sensor', message: `Porta ${label}` });
    }
  }

  handleWindowEvent(payload) {
    const label = payload.isOpen ? 'aperta' : 'chiusa';
    console.log(`[Orchestrator] Evento WoT: Finestra ${label}`);
    if (this.securityMode && payload.isOpen) {
      this.triggerSecurityAlert('Finestra aperta', 'critical');
    } else {
      this.broadcast({ type: 'log', category: 'sensor', message: `Finestra ${label}` });
    }
  }

  handleMotionEvent(payload) {
    const label = payload.motionDetected ? 'rilevato' : 'cessato';
    console.log(`[Orchestrator] Evento WoT: Movimento ${label}`);
    if (this.securityMode && payload.motionDetected) {
      this.triggerSecurityAlert('Movimento rilevato', 'warning');
    } else {
      this.broadcast({ type: 'log', category: 'sensor', message: `Movimento ${label}` });
    }
  }

  // ---- Azioni verso le altre Thing: solo invokeAction()/readProperty() ----

  async triggerSecurityAlert(message, severity = 'warning') {
    const alert = { timestamp: new Date().toISOString(), message, severity };
    this.alertHistory.push(alert);

    try {
      // Invocazione reale via WoT invece della chiamata diretta al metodo JS
      await this.alarmSystem.invokeAction('triggerAlarm');
      await this.notificationService.invokeAction('sendNotification', { message, severity });
    } catch (err) {
      console.error('[Orchestrator] Errore durante invokeAction:', err);
    }

    console.log(`[Orchestrator] ALERTA DI SICUREZZA: ${message}`);
    this.broadcast({
      type: 'log',
      category: 'alert',
      message: `⚠️ ${message} — allarme attivato, notifica inviata`
    });
  }

  async activateSecurityMode() {
    this.securityMode = true;
    console.log('[Orchestrator] Modalità Sicurezza ATTIVATA');

    await this.notificationService.invokeAction('sendNotification', {
      message: 'Modalità Sicurezza attivata - Away Mode',
      severity: 'info'
    });

    this.broadcast({ type: 'log', category: 'sensor', message: 'Modalità Sicurezza attivata' });
  }

  async deactivateSecurityMode() {
    this.securityMode = false;

    await this.alarmSystem.invokeAction('resetAlarm');
    console.log('[Orchestrator] Modalità Sicurezza DISATTIVATA');

    await this.notificationService.invokeAction('sendNotification', {
      message: 'Modalità Sicurezza disattivata',
      severity: 'info'
    });

    this.broadcast({
      type: 'log',
      category: 'sensor',
      message: 'Modalità Sicurezza disattivata — allarme resettato'
    });
  }

  // Property locale (stato interno dell'Orchestrator) + esempio di
  // readProperty() reale su una ConsumedThing (alarmStatus dell'Alarm System).
  async getProperty(propName) {
    if (propName === 'securityMode') {
      return { value: this.securityMode };
    }
    if (propName === 'alarmStatus' && this.alarmSystem) {
      const output = await this.alarmSystem.readProperty('alarmStatus');
      return { value: await output.value() };
    }
    return null;
  }

  getAlertHistory(limit = 10) { return this.alertHistory.slice(-limit); }
  clearAlertHistory() { this.alertHistory = []; }
}

module.exports = Orchestrator;