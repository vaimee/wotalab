/**
 * Alarm System Thing
 * Sistema responsabile dell'attivazione e del reset dell'allarme
 */

const { v4: uuidv4 } = require('uuid');

class AlarmSystem {
  constructor(mqttClient, broadcast) {
    this.id = uuidv4();
    this.title = 'Alarm System';
    this.type = ['Thing'];
    this.description = 'Sistema responsabile dell\'attivazione e del reset dell\'allarme';
    this.alarmStatus = 'RESET'; // RESET, TRIGGERED
    this.mqttClient = mqttClient;
    this.broadcast = broadcast || (() => {});
    
    this.thingDescriptionURI = `/things/alarm-system/td`;
    this.baseURI = '/things/alarm-system';
    
    this.generateThingDescription();
  }

  generateThingDescription() {
    this.thingDescription = {
      '@context': [
        'https://www.w3.org/2022/wot/td/v1.1',
        { '@language': 'it' }
      ],
      '@type': 'Thing',
      'id': `urn:wot:alarm-system:${this.id}`,
      'title': this.title,
      'description': this.description,
      'securityDefinitions': {
        'nosec_sc': {
          'scheme': 'nosec'
        }
      },
      'security': 'nosec_sc',
      'properties': {
        'alarmStatus': {
          'title': 'Stato Allarme',
          'description': 'Stato dell\'allarme: RESET o TRIGGERED',
          'type': 'string',
          'enum': ['RESET', 'TRIGGERED'],
          'readOnly': true,
          'forms': [
            {
              'href': `${this.baseURI}/properties/alarmStatus`,
              'contentType': 'application/json',
              'op': 'readproperty'
            }
          ]
        }
      },
      'actions': {
        'triggerAlarm': {
          'title': 'Attiva Allarme',
          'description': 'Attiva il sistema di allarme',
          'forms': [
            {
              'href': `${this.baseURI}/actions/triggerAlarm`,
              'contentType': 'application/json',
              'op': 'invokeaction'
            }
          ]
        },
        'resetAlarm': {
          'title': 'Reset Allarme',
          'description': 'Resetta il sistema di allarme',
          'forms': [
            {
              'href': `${this.baseURI}/actions/resetAlarm`,
              'contentType': 'application/json',
              'op': 'invokeaction'
            }
          ]
        }
      },
      'events': {
        'alarmTriggered': {
          'title': 'Allarme Attivato',
          'description': 'Evento generato quando l\'allarme viene attivato',
          'data': {
            'type': 'object',
            'properties': {
              'timestamp': { 'type': 'string' },
              'alarmStatus': { 'type': 'string' }
            }
          },
          'forms': [
            {
              'href': `mqtt://localhost:1883/events/alarm-system/alarmTriggered`,
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
    if (propName === 'alarmStatus') {
      return { value: this.alarmStatus };
    }
    return null;
  }

  getAllProperties() {
    return {
      alarmStatus: this.alarmStatus
    };
  }

  triggerAlarm() {
    this.alarmStatus = 'TRIGGERED';
    const eventPayload = {
      timestamp: new Date().toISOString(),
      alarmStatus: this.alarmStatus
    };
    
    console.log('[AlarmSystem] ALLARME ATTIVATO!');
    
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/alarm-system/alarmTriggered',
        JSON.stringify(eventPayload),
        { qos: 1 }
      );
    }
  }

  resetAlarm() {
    this.alarmStatus = 'RESET';
    console.log('[AlarmSystem] Allarme resettato');
    
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(
        'events/alarm-system/alarmReset',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          alarmStatus: this.alarmStatus
        }),
        { qos: 1 }
      );
    }
  }
}

module.exports = AlarmSystem;