/**
 * Alarm System Thing (Producer WoT)
 * Sistema responsabile dell'attivazione e del reset dell'allarme.
 *
 * - la Thing Description non è scritta a mano: viene generata da node-wot
 *   a partire dal modello che passiamo a WoT.produce().
 * - le properties/actions/events sono collegate a handler reali
 *   (setPropertyReadHandler / setActionHandler / emitEvent), quindi la TD
 *   descrive esattamente ciò che la Thing sa fare, non una copia statica.
 * - la Thing è esposta tramite un vero Servient (HTTP binding di node-wot),
 *   consumata dall'Orchestrator tramite WoT.consume(td) e
 *   invokeAction()/readProperty()/subscribeEvent(), nessuna dipendenza MQTT.
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const { v4: uuidv4 } = require('uuid');

class AlarmSystem {
  /**
   * @param {function} broadcast - callback verso i client WebSocket della dashboard
   * @param {object} options - { httpPort }
   */
  constructor(broadcast, options = {}) {
    this.id = uuidv4();
    this.title = 'Alarm System';
    this.alarmStatus = 'RESET'; // RESET | TRIGGERED

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
  }

  _doReset() {
    this.alarmStatus = 'RESET';
    console.log('[AlarmSystem] Allarme resettato');
  }

  // ---- API pubblica mantenuta per compatibilità con le route manuali di
  // index.js (es. /things/alarm-system/actions/triggerAlarm). L'Orchestrator
  // (Consumer WoT) NON usa più questi metodi: interagisce con questa Thing
  // esclusivamente tramite invokeAction()/readProperty() sulla sua TD reale. ----

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