/**
 * Motion Sensor Thing
 * Sensore che rileva movimento all'interno dell'ambiente
 */

const { v4: uuidv4 } = require('uuid');

class MotionSensor {
  constructor(mqttClient) {
    this.id = uuidv4();
    this.title = 'Motion Sensor';
    this.type = ['Thing'];
    this.description = 'Sensore che rileva movimento all\'interno dell\'ambiente';
    this.motionDetected = false;
    this.mqttClient = mqttClient;
    
    this.thingDescriptionURI = `/things/motion-sensor/td`;
    this.baseURI = '/things/motion-sensor';
    
    this.generateThingDescription();
  }

  generateThingDescription() {
    this.thingDescription = {
      '@context': [
        'https://www.w3.org/2022/wot/td/v1.1',
        { '@language': 'it' }
      ],
      '@type': 'Thing',
      'id': `urn:wot:motion-sensor:${this.id}`,
      'title': this.title,
      'description': this.description,
      'securityDefinitions': {
        'nosec_sc': {
          'scheme': 'nosec'
        }
      },
      'security': 'nosec_sc',
      'properties': {
        'motionDetected': {
          'title': 'Movimento Rilevato',
          'description': 'Indica se è stato rilevato movimento',
          'type': 'boolean',
          'readOnly': true,
          'forms': [
            {
              'href': `${this.baseURI}/properties/motionDetected`,
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
        'motionDetected': {
          'title': 'Movimento Rilevato',
          'description': 'Evento generato quando viene rilevato movimento',
          'data': {
            'type': 'object',
            'properties': {
              'timestamp': { 'type': 'string' },
              'motionDetected': { 'type': 'boolean' }
            }
          },
          'forms': [
            {
              'href': `mqtt://localhost:1883/events/motion-sensor/motionDetected`,
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
    if (propName === 'motionDetected') {
      return { value: this.motionDetected };
    }
    if (propName === 'lastUpdate') {
      return { value: new Date().toISOString() };
    }
    return null;
  }

  getAllProperties() {
    return {
      motionDetected: this.motionDetected,
      lastUpdate: new Date().toISOString()
    };
  }

  setMotionDetected(state) {
    this.motionDetected = state;
    const eventPayload = {
      timestamp: new Date().toISOString(),
      motionDetected: state
    };
    
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/motion-sensor/motionDetected',
        JSON.stringify(eventPayload),
        { qos: 1 }
      );
    }
  }

}

module.exports = MotionSensor;
