/**
 * Door Sensor Thing (Producer WoT)
 * Sensore che rileva apertura e chiusura della porta.
 *
 * La TD è generata da node-wot a partire da un vero ExposedThing, non
 * scritta a mano. L'azione "setOpen" è dichiarata correttamente come action
 * della Thing. Non ha più alcuna dipendenza da MQTT: l'Orchestrator (Consumer
 * WoT) consuma questa Thing solo tramite la sua TD reale, con
 * subscribeEvent()/readProperty()/invokeAction().
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const { v4: uuidv4 } = require('uuid');

class DoorSensor {
  constructor(options = {}) {
    this.id = uuidv4();
    this.title = 'Door Sensor';
    this.description = 'Sensore che rileva apertura e chiusura della porta';
    this.isOpen = false;

    this.httpPort = options.httpPort || 3001;

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
      id: `urn:wot:door-sensor:${this.id}`,
      title: this.title,
      description: this.description,
      properties: {
        isOpen: {
          title: 'Stato Porta',
          description: 'Indica se la porta è aperta',
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
          title: 'Imposta Stato Porta',
          description: 'Simula apertura/chiusura della porta (uso manuale/test)',
          input: { type: 'boolean' }
        }
      },
      events: {
        doorOpened: {
          title: 'Porta Aperta',
          description: 'Evento generato quando la porta viene aperta',
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

    console.log(`[DoorSensor] Esposto come vera WoT Thing su http://localhost:${this.httpPort}/door-sensor`);
  }

  _doSetOpen(state) {
    this.isOpen = state;
    const eventPayload = {
      timestamp: new Date().toISOString(),
      isOpen: state
    };

    if (this.exposedThing) {
      this.exposedThing.emitEvent('doorOpened', eventPayload);
    }
  }

  // ---- API pubblica mantenuta per compatibilità con le route manuali di
  // index.js (es. /things/door-sensor/actions/setOpen). L'Orchestrator
  // (Consumer WoT) NON usa più questi metodi: legge lo stato tramite
  // subscribeEvent()/readProperty() sulla TD reale. ----

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

module.exports = DoorSensor;