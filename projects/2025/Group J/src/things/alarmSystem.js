/**
 * Alarm System Thing (Producer WoT)
 * Sistema responsabile dell'attivazione e del reset dell'allarme.
 *
 * La TD è generata da node-wot a partire da un ExposedThing, con
 * property/action/evento collegati ai rispettivi handler. L'unico canale
 * di comunicazione è quello dichiarato nella TD (HTTP, con eventi via
 * long-polling).
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { getOntologyContext, getClass } = require('../ontology/ontologyLoader');

class AlarmSystem {
  /**
   * @param {object} options - { httpPort, directoryUrl }
   */
  constructor(options = {}) {
    this.id = uuidv4();
    this.title = 'Alarm System';
    this.alarmStatus = 'RESET'; // RESET | TRIGGERED

    this.httpPort = options.httpPort || 3004;
    this.directoryUrl = options.directoryUrl || null;

    this.exposedThing = null;
    this.thingDescription = null;

    this.ready = this._exposeAsThing();
  }

  async _exposeAsThing() {
    this.servient = new Servient();
    this.servient.addServer(
      new HttpServer({
        port: this.httpPort,
        baseUri: `http://localhost:${this.httpPort}`,
        middleware: cors()
      })
    );

    const WoT = await this.servient.start();

    this.exposedThing = await WoT.produce({
      '@context': ['https://www.w3.org/2022/wot/td/v1.1', { '@language': 'it' }, getOntologyContext()],
      '@type': getClass('AlarmSystem'),
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

    console.log(`[AlarmSystem] Thing esposta su http://localhost:${this.httpPort}/alarm-system`);

    await this._registerInDirectory();
  }

  async _registerInDirectory() {
    if (!this.directoryUrl) return;
    try {
      const res = await fetch(`${this.directoryUrl}/things`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.thingDescription)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`[AlarmSystem] Registrata nella Thing Directory (${this.directoryUrl})`);
    } catch (err) {
      console.error(`[AlarmSystem] Registrazione nella Directory fallita: ${err.message}`);
    }
  }

  _doTrigger() {
    this.alarmStatus = 'TRIGGERED';
    const eventPayload = {
      timestamp: new Date().toISOString(),
      alarmStatus: this.alarmStatus
    };

    console.log('[AlarmSystem] ALLARME ATTIVATO!');

    if (this.exposedThing) {
      this.exposedThing.emitEvent('alarmTriggered', eventPayload);
    }
  }

  _doReset() {
    this.alarmStatus = 'RESET';
    console.log('[AlarmSystem] Allarme resettato');
  }

}

module.exports = AlarmSystem;