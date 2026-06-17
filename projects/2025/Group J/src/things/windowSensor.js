/**
 * Window Sensor Thing
 * Sensore che rileva apertura e chiusura delle finestre
 */

const { v4: uuidv4 } = require('uuid');

class WindowSensor {
  constructor(mqttClient) {
    this.id = uuidv4();
    this.title = 'Window Sensor';
    this.type = ['Thing'];
    this.description = 'Sensore che rileva apertura e chiusura delle finestre';
    this.isOpen = false;
    this.mqttClient = mqttClient;
    
    this.thingDescriptionURI = `/things/window-sensor/td`;
    this.baseURI = '/things/window-sensor';
    
    this.generateThingDescription();
  }

  generateThingDescription() {
    this.thingDescription = {
      '@context': [
        'https://www.w3.org/2022/wot/td/v1.1',
        { '@language': 'it' }
      ],
      '@type': 'Thing',
      'id': `urn:wot:window-sensor:${this.id}`,
      'title': this.title,
      'description': this.description,
      'securityDefinitions': {
        'nosec_sc': {
          'scheme': 'nosec'
        }
      },
      'security': 'nosec_sc',
      'properties': {
        'isOpen': {
          'title': 'Stato Finestra',
          'description': 'Indica se la finestra è aperta',
          'type': 'boolean',
          'readOnly': true,
          'forms': [
            {
              'href': `${this.baseURI}/properties/isOpen`,
              'contentType': 'application/json',
              'op': 'readproperty'
            }
          ]
        },
        'lastUpdate': {
          'title': 'Ultimo Aggiornamento',
          'description': 'Timestamp dell\'ultimo evento',
          'type': 'string',
          'readOnly': true,
          'forms': [
            {
              'href': `${this.baseURI}/properties/lastUpdate`,
              'contentType': 'application/json',
              'op': 'readproperty'
            }
          ]
        }
      },
      'events': {
        'windowOpened': {
          'title': 'Finestra Aperta',
          'description': 'Evento generato quando la finestra viene aperta',
          'data': {
            'type': 'object',
            'properties': {
              'timestamp': { 'type': 'string' },
              'isOpen': { 'type': 'boolean' }
            }
          },
          'forms': [
            {
              'href': `mqtt://localhost:1883/events/window-sensor/windowOpened`,
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

  getProperty(propName) {
    if (propName === 'isOpen') {
      return { value: this.isOpen };
    }
    if (propName === 'lastUpdate') {
      return { value: new Date().toISOString() };
    }
    return null;
  }

  getAllProperties() {
    return {
      isOpen: this.isOpen,
      lastUpdate: new Date().toISOString()
    };
  }

  setOpen(state) {
    this.isOpen = state;
    const eventPayload = {
      timestamp: new Date().toISOString(),
      isOpen: state
    };
    
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/window-sensor/windowOpened',
        JSON.stringify(eventPayload),
        { qos: 1 }
      );
    }
  }

}

module.exports = WindowSensor;
