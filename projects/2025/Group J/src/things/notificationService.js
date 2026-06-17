/**
 * Notification Service Thing
 * Servizio che simula l'invio di notifiche all'utente
 */

const { v4: uuidv4 } = require('uuid');

class NotificationService {
  constructor(mqttClient, broadcast) {
    this.id = uuidv4();
    this.title = 'Notification Service';
    this.type = ['Thing'];
    this.description = 'Servizio che simula l\'invio di notifiche all\'utente';
    this.notifications = [];
    this.mqttClient = mqttClient;
    this.broadcast = broadcast || (() => {});
    
    this.thingDescriptionURI = `/things/notification-service/td`;
    this.baseURI = '/things/notification-service';
    
    this.generateThingDescription();
  }

  generateThingDescription() {
    this.thingDescription = {
      '@context': [
        'https://www.w3.org/2022/wot/td/v1.1',
        { '@language': 'it' }
      ],
      '@type': 'Thing',
      'id': `urn:wot:notification-service:${this.id}`,
      'title': this.title,
      'description': this.description,
      'securityDefinitions': {
        'nosec_sc': {
          'scheme': 'nosec'
        }
      },
      'security': 'nosec_sc',
      'actions': {
        'sendNotification': {
          'title': 'Invia Notifica',
          'description': 'Invia una notifica all\'utente',
          'input': {
            'type': 'object',
            'properties': {
              'message': {
                'type': 'string',
                'description': 'Messaggio della notifica'
              },
              'severity': {
                'type': 'string',
                'enum': ['info', 'warning', 'critical'],
                'description': 'Livello di gravità'
              }
            },
            'required': ['message']
          },
          'forms': [
            {
              'href': `${this.baseURI}/actions/sendNotification`,
              'contentType': 'application/json',
              'op': 'invokeaction'
            }
          ]
        }
      },
      'events': {
        'notificationSent': {
          'title': 'Notifica Inviata',
          'description': 'Evento generato quando una notifica viene inviata',
          'data': {
            'type': 'object',
            'properties': {
              'timestamp': { 'type': 'string' },
              'message': { 'type': 'string' },
              'severity': { 'type': 'string' }
            }
          },
          'forms': [
            {
              'href': `mqtt://localhost:1883/events/notification-service/notificationSent`,
              'contentType': 'application/json',
              'op': 'subscribeevent'
            }
          ]
        }
      },
      'base': `http://localhost:3000${this.baseURI}/`
    };
  }

  getThingDescription() {
    return this.thingDescription;
  }

  sendNotification(message, severity = 'info') {
    const notification = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      message,
      severity
    };
    
    this.notifications.push(notification);
    
    console.log(`[NotificationService] [${severity.toUpperCase()}] ${message}`);
    
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/notification-service/notificationSent',
        JSON.stringify(notification),
        { qos: 1 }
      );
    }
    
    return notification;
  }

  getNotifications(limit = 10) {
    return this.notifications.slice(-limit);
  }

  clearNotifications() {
    this.notifications = [];
  }
}

module.exports = NotificationService;