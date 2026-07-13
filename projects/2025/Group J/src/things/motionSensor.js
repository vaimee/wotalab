/**
 * Motion Sensor Thing (Producer WoT)
 * Sensore che rileva movimento all'interno dell'ambiente.
 * Stessa logica di doorSensor.js/windowSensor.js, incluse autoregistrazione
 * nella Thing Directory e annotazione semantica reale da ontology.jsonld.
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { getOntologyContext, getClass } = require('../ontology/ontologyLoader');

class MotionSensor {
  constructor(options = {}) {
    this.id = uuidv4();
    this.title = 'Motion Sensor';
    this.description = "Sensore che rileva movimento all'interno dell'ambiente";
    this.motionDetected = false;

    this.httpPort = options.httpPort || 3003;
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
      '@type': getClass('MotionSensor'),
      id: `urn:wot:motion-sensor:${this.id}`,
      title: this.title,
      description: this.description,
      properties: {
        motionDetected: {
          title: 'Movimento Rilevato',
          description: 'Indica se è stato rilevato movimento',
          type: 'boolean',
          readOnly: true
        },
        lastUpdate: {
          title: 'Ultimo Aggiornamento',
          description: "Timestamp dell'ultimo evento",
          type: 'string',
          readOnly: true
        }
      },
      actions: {
        setMotionDetected: {
          title: 'Imposta Movimento',
          description: 'Simula rilevamento di movimento (uso manuale/test)',
          input: { type: 'boolean' }
        }
      },
      events: {
        motionDetected: {
          title: 'Movimento Rilevato',
          description: 'Evento generato quando viene rilevato movimento',
          data: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              motionDetected: { type: 'boolean' }
            }
          }
        }
      }
    });

    this.exposedThing.setPropertyReadHandler('motionDetected', async () => this.motionDetected);
    this.exposedThing.setPropertyReadHandler('lastUpdate', async () => new Date().toISOString());
    this.exposedThing.setActionHandler('setMotionDetected', async (params) => {
      const state = await params.value();
      this._doSetMotionDetected(state);
      return undefined;
    });

    await this.exposedThing.expose();
    this.thingDescription = this.exposedThing.getThingDescription();

    console.log(`[MotionSensor] Esposto come vera WoT Thing su http://localhost:${this.httpPort}/motion-sensor`);

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
      console.log(`[MotionSensor] Registrata nella Thing Directory (${this.directoryUrl})`);
    } catch (err) {
      console.error(`[MotionSensor] Registrazione nella Directory fallita: ${err.message}`);
    }
  }

  _doSetMotionDetected(state) {
    this.motionDetected = state;
    const eventPayload = {
      timestamp: new Date().toISOString(),
      motionDetected: state
    };

    if (this.exposedThing) {
      this.exposedThing.emitEvent('motionDetected', eventPayload);
    }
  }

  setMotionDetected(state) {
    this._doSetMotionDetected(state);
  }

  getProperty(propName) {
    if (propName === 'motionDetected') return { value: this.motionDetected };
    if (propName === 'lastUpdate') return { value: new Date().toISOString() };
    return null;
  }

  getAllProperties() {
    return {
      motionDetected: this.motionDetected,
      lastUpdate: new Date().toISOString()
    };
  }

  async getThingDescription() {
    await this.ready;
    return this.thingDescription;
  }
}

module.exports = MotionSensor;