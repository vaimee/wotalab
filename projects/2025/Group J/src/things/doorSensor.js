/**
 * Door Sensor Thing (Producer WoT)
 * Sensore che rileva apertura e chiusura della porta.
 *
 * Stesse note di alarmSystem.js: la TD è generata da node-wot a partire da
 * un vero ExposedThing, non scritta a mano. In più, l'azione "setOpen"
 * (che nel progetto originale esisteva solo come route HTTP manuale in
 * index.js, senza comparire nella TD) è ora dichiarata correttamente come
 * action della Thing.
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const { v4: uuidv4 } = require('uuid');

class DoorSensor {
  constructor(mqttClient, options = {}) {
    this.id = uuidv4();
    this.title = 'Door Sensor';
    this.description = 'Sensore che rileva apertura e chiusura della porta';
    this.isOpen = false;

    this.mqttClient = mqttClient;
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

    // TODO(rimuovere dopo il refactor dell'Orchestrator): pubblicazione MQTT
    // legacy, mantenuta finché l'Orchestrator non fa subscribeEvent() sulla TD.
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/door-sensor/doorOpened',
        JSON.stringify(eventPayload),
        { qos: 1 }
      );
    }
  }

  // ---- API pubblica mantenuta per compatibilità con index.js/Orchestrator attuali ----

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