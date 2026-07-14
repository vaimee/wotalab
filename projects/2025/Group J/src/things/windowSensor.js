/**
 * Window Sensor Thing (Producer WoT)
 * Sensore che rileva apertura e chiusura delle finestre.
 * Stessa logica di doorSensor.js, incluse autoregistrazione nella Thing
 * Directory e annotazione semantica tramite ontology.jsonld.
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { getOntologyContext, getClass } = require('../ontology/ontologyLoader');

class WindowSensor {
  constructor(options = {}) {
    this.id = uuidv4();
    this.title = 'Window Sensor';
    this.description = 'Sensore che rileva apertura e chiusura delle finestre';
    this.isOpen = false;

    this.httpPort = options.httpPort || 3002;
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
      '@type': getClass('WindowSensor'),
      id: `urn:wot:window-sensor:${this.id}`,
      title: this.title,
      description: this.description,
      properties: {
        isOpen: {
          title: 'Stato Finestra',
          description: 'Indica se la finestra è aperta',
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
        setOpen: {
          title: 'Imposta Stato Finestra',
          description: 'Simula apertura/chiusura della finestra (uso manuale/test)',
          input: { type: 'boolean' }
        }
      },
      events: {
        windowOpened: {
          title: 'Finestra Aperta',
          description: 'Evento generato quando la finestra viene aperta',
          data: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              isOpen: { type: 'boolean' }
            }
          }
        }
      }
    });

    this.exposedThing.setPropertyReadHandler('isOpen', async () => this.isOpen);
    this.exposedThing.setPropertyReadHandler('lastUpdate', async () => new Date().toISOString());
    this.exposedThing.setActionHandler('setOpen', async (params) => {
      const state = await params.value();
      this._doSetOpen(state);
      return undefined;
    });

    await this.exposedThing.expose();
    this.thingDescription = this.exposedThing.getThingDescription();

    console.log(`[WindowSensor] Thing esposta su http://localhost:${this.httpPort}/window-sensor`);

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
      console.log(`[WindowSensor] Registrata nella Thing Directory (${this.directoryUrl})`);
    } catch (err) {
      console.error(`[WindowSensor] Registrazione nella Directory fallita: ${err.message}`);
    }
  }

  _doSetOpen(state) {
    this.isOpen = state;
    const eventPayload = {
      timestamp: new Date().toISOString(),
      isOpen: state
    };

    if (this.exposedThing) {
      this.exposedThing.emitEvent('windowOpened', eventPayload);
    }
  }

}

module.exports = WindowSensor;