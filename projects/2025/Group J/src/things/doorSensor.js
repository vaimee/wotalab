/**
 * Door Sensor Thing
 * Sensore che rileva apertura e chiusura della porta
 */

const { v4: uuidv4 } = require('uuid');

class DoorSensor {
  constructor(mqttClient) {
    this.id = uuidv4();
    this.title = 'Door Sensor';
    this.type = ['Thing'];
    this.description = 'Sensore che rileva apertura e chiusura della porta';
    this.isOpen = false;
    this.mqttClient = mqttClient;
    
    this.thingDescriptionURI = `/things/door-sensor/td`;
    this.baseURI = '/things/door-sensor';
    
    this.generateThingDescription();
  }

  generateThingDescription() {
    this.thingDescription = {
      '@context': [
        'https://www.w3.org/2022/wot/td/v1.1',
        { '@language': 'it' }
      ],
      '@type': 'Thing',
      'id': `urn:wot:door-sensor:${this.id}`,
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
          'title': 'Stato Porta',
          'description': 'Indica se la porta è aperta',
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
        'doorOpened': {
          'title': 'Porta Aperta',
          'description': 'Evento generato quando la porta viene aperta',
          'data': {
            'type': 'object',
            'properties': {
              'timestamp': { 'type': 'string' },
              'isOpen': { 'type': 'boolean' }
            }
          },
          'forms': [
            {
              'href': `mqtt://localhost:1883/events/door-sensor/doorOpened`,
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
        'events/door-sensor/doorOpened',
        JSON.stringify(eventPayload),
        { qos: 1 }
      );
    }
  }

}

module.exports = DoorSensor;
