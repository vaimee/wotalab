/**
 * Window Sensor Thing (Producer WoT)
 * Sensore che rileva apertura e chiusura delle finestre.
 * Stessa logica di doorSensor.js.
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const { v4: uuidv4 } = require('uuid');

class WindowSensor {
  constructor(mqttClient, options = {}) {
    this.id = uuidv4();
    this.title = 'Window Sensor';
    this.description = 'Sensore che rileva apertura e chiusura delle finestre';
    this.isOpen = false;

    this.mqttClient = mqttClient;
    this.httpPort = options.httpPort || 3002;

    this.exposedThing = null;
    this.thingDescription = null;

    this.ready = this._exposeAsThing();
  }

  async _exposeAsThing() {
    this.servient = new Servient();
    this.servient.addServer(new HttpServer({ port: this.httpPort }));

    const WoT = await this.servient.start();

    this.exposedThing = await WoT.produce({
      '@context': ['https://www.w3.org/2022/wot/td/v1.1', { '@language': 'it' }],
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

    console.log(`[WindowSensor] Esposto come vera WoT Thing su http://localhost:${this.httpPort}/window-sensor`);
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

    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/window-sensor/windowOpened',
        JSON.stringify(eventPayload),
        { qos: 1 }
      );
    }
  }

  setOpen(state) {
    this._doSetOpen(state);
  }

  getProperty(propName) {
    if (propName === 'isOpen') return { value: this.isOpen };
    if (propName === 'lastUpdate') return { value: new Date().toISOString() };
    return null;
  }

  getAllProperties() {
    return {
      isOpen: this.isOpen,
      lastUpdate: new Date().toISOString()
    };
  }

  async getThingDescription() {
    await this.ready;
    return this.thingDescription;
  }
}

module.exports = WindowSensor;