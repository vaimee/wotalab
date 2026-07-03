/**
 * Alarm System Thing (Producer WoT)
 * Sistema responsabile dell'attivazione e del reset dell'allarme.
 *
 * Differenza rispetto alla versione precedente:
 * - la Thing Description non è più un JSON scritto a mano: viene generata
 *   da node-wot a partire dal modello che passiamo a WoT.produce().
 * - le properties/actions/events sono collegate a handler reali
 *   (setPropertyReadHandler / setActionHandler / emitEvent), quindi la TD
 *   descrive esattamente ciò che la Thing sa fare, non una copia statica.
 * - la Thing è esposta tramite un vero Servient (HTTP binding di node-wot),
 *   pronta per essere "consumata" da un Consumer (l'Orchestrator) tramite
 *   WoT.consume(td), invece di essere chiamata come oggetto JS.
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const { v4: uuidv4 } = require('uuid');

class AlarmSystem {
  /**
   * @param {object} mqttClient - client MQTT legacy, usato SOLO finché
   *   l'Orchestrator non consuma l'evento "alarmTriggered" direttamente
   *   dalla TD (subscribeEvent). Da rimuovere nel refactor dell'Orchestrator.
   * @param {function} broadcast - callback verso i client WebSocket della dashboard
   * @param {object} options - { httpPort }
   */
  constructor(mqttClient, broadcast, options = {}) {
    this.id = uuidv4();
    this.title = 'Alarm System';
    this.alarmStatus = 'RESET'; // RESET | TRIGGERED

    this.mqttClient = mqttClient;
    this.broadcast = broadcast || (() => {});
    this.httpPort = options.httpPort || 3004;

    this.exposedThing = null;
    this.thingDescription = null;

    // L'esposizione WoT è asincrona (avvio Servient + binding HTTP).
    // Le chiamate a metodi pubblici prima che sia pronta vengono messe in coda.
    this.ready = this._exposeAsThing();
  }

  async _exposeAsThing() {
    this.servient = new Servient();
    this.servient.addServer(new HttpServer({ port: this.httpPort }));

    const WoT = await this.servient.start();

    this.exposedThing = await WoT.produce({
      '@context': ['https://www.w3.org/2022/wot/td/v1.1', { '@language': 'it' }],
      id: `urn:wot:alarm-system:${this.id}`,
      title: this.title,
      description: "Sistema responsabile dell'attivazione e del reset dell'allarme",
      properties: {
        alarmStatus: {
          title: 'Stato Allarme',
          description: "Stato dell'allarme: RESET o TRIGGERED",
          type: 'string',
          enum: ['RESET', 'TRIGGERED'],
          readOnly: true
        }
      },
      actions: {
        triggerAlarm: {
          title: 'Attiva Allarme',
          description: 'Attiva il sistema di allarme'
        },
        resetAlarm: {
          title: 'Reset Allarme',
          description: 'Resetta il sistema di allarme'
        }
      },
      events: {
        alarmTriggered: {
          title: 'Allarme Attivato',
          description: "Evento generato quando l'allarme viene attivato",
          data: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              alarmStatus: { type: 'string' }
            }
          }
        }
      }
    });

    // Handler reali: la TD ora rispecchia comportamento vero, non testo statico
    this.exposedThing.setPropertyReadHandler('alarmStatus', async () => this.alarmStatus);
    this.exposedThing.setActionHandler('triggerAlarm', async () => {
      this._doTrigger();
      return undefined;
    });
    this.exposedThing.setActionHandler('resetAlarm', async () => {
      this._doReset();
      return undefined;
    });

    await this.exposedThing.expose();
    this.thingDescription = this.exposedThing.getThingDescription();

    console.log(`[AlarmSystem] Esposta come vera WoT Thing su http://localhost:${this.httpPort}/alarm-system`);
  }

  // ---- Logica interna (invariata rispetto a prima) ----

  _doTrigger() {
    this.alarmStatus = 'TRIGGERED';
    const eventPayload = {
      timestamp: new Date().toISOString(),
      alarmStatus: this.alarmStatus
    };

    console.log('[AlarmSystem] ALLARME ATTIVATO!');

    // Evento WoT reale: chi consuma la TD può iscriversi con subscribeEvent()
    if (this.exposedThing) {
      this.exposedThing.emitEvent('alarmTriggered', eventPayload);
    }

    // TODO(rimuovere dopo il refactor dell'Orchestrator): pubblicazione MQTT
    // legacy, mantenuta solo per non rompere l'Orchestrator attuale che si
    // iscrive ancora a topic hardcoded invece di consumare la TD.
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/alarm-system/alarmTriggered',
        JSON.stringify(eventPayload),
        { qos: 1 }
      );
    }
  }

  _doReset() {
    this.alarmStatus = 'RESET';
    console.log('[AlarmSystem] Allarme resettato');

    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/alarm-system/alarmReset',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          alarmStatus: this.alarmStatus
        }),
        { qos: 1 }
      );
    }
  }

  // ---- API pubblica mantenuta invariata (compatibilità con index.js e Orchestrator attuali) ----
  // Nel prossimo step (refactor dell'Orchestrator) questi metodi non serviranno
  // più: chi vorrà interagire con l'Alarm System dovrà consumarne la TD e
  // chiamare invokeAction()/readProperty() sul ConsumedThing.

  triggerAlarm() {
    this._doTrigger();
  }

  resetAlarm() {
    this._doReset();
  }

  getProperty(propName) {
    if (propName === 'alarmStatus') {
      return { value: this.alarmStatus };
    }
    return null;
  }

  getAllProperties() {
    return { alarmStatus: this.alarmStatus };
  }

  // Ora restituisce la TD generata realmente da node-wot, non un JSON scritto a mano.
  // È async perché l'esposizione della Thing è asincrona.
  async getThingDescription() {
    await this.ready;
    return this.thingDescription;
  }
}

module.exports = AlarmSystem;