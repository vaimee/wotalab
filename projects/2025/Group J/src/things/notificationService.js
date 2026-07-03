/**
 * Notification Service Thing (Producer WoT)
 * Servizio che simula l'invio di notifiche all'utente.
 */

const { Servient } = require('@node-wot/core');
const { HttpServer } = require('@node-wot/binding-http');
const { v4: uuidv4 } = require('uuid');

class NotificationService {
  constructor(mqttClient, broadcast, options = {}) {
    this.id = uuidv4();
    this.title = 'Notification Service';
    this.description = "Servizio che simula l'invio di notifiche all'utente";
    this.notifications = [];

    this.mqttClient = mqttClient;
    this.broadcast = broadcast || (() => {});
    this.httpPort = options.httpPort || 3005;

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
      id: `urn:wot:notification-service:${this.id}`,
      title: this.title,
      description: this.description,
      actions: {
        sendNotification: {
          title: 'Invia Notifica',
          description: "Invia una notifica all'utente",
          input: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Messaggio della notifica' },
              severity: {
                type: 'string',
                enum: ['info', 'warning', 'critical'],
                description: 'Livello di gravità'
              }
            },
            required: ['message']
          }
        }
      },
      events: {
        notificationSent: {
          title: 'Notifica Inviata',
          description: 'Evento generato quando una notifica viene inviata',
          data: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string' }
            }
          }
        }
      }
    });

    this.exposedThing.setActionHandler('sendNotification', async (params) => {
      const input = await params.value();
      const notification = this._doSendNotification(input.message, input.severity || 'info');
      return notification;
    });

    await this.exposedThing.expose();
    this.thingDescription = this.exposedThing.getThingDescription();

    console.log(`[NotificationService] Esposto come vera WoT Thing su http://localhost:${this.httpPort}/notification-service`);
  }

  _doSendNotification(message, severity = 'info') {
    const notification = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      message,
      severity
    };

    this.notifications.push(notification);
    console.log(`[NotificationService] [${severity.toUpperCase()}] ${message}`);

    if (this.exposedThing) {
      this.exposedThing.emitEvent('notificationSent', notification);
    }

    // TODO(rimuovere dopo il refactor dell'Orchestrator): pubblicazione MQTT legacy.
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/notification-service/notificationSent',
        JSON.stringify(notification),
        { qos: 1 }
      );
    }

    return notification;
  }

  // ---- API pubblica mantenuta per compatibilità con index.js/Orchestrator attuali ----

  sendNotification(message, severity = 'info') {
    return this._doSendNotification(message, severity);
  }

  getNotifications(limit = 10) {
    return this.notifications.slice(-limit);
  }

  clearNotifications() {
    this.notifications = [];
  }

  async getThingDescription() {
    await this.ready;
    return this.thingDescription;
  }
}

module.exports = NotificationService;