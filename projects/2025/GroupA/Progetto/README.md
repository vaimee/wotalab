# Passaggi Installazione
### Windows
- Installa Nodejs
- Vai sul sito *https://mosquitto.org/download/*
- Scarica la versione **mosquitto-2.1.2-install-windows-x64.exe**
- Dopo l’installazione apri Powershell come amministratore e digita: **net start mosquitto**
 (potrebbe dire che il servizio è già avviato).
- Vai su visual studio code, apri il progetto e da terminale fai:
  
  • **npm install**

  • **npx tsc**
  
  • **node dist/things/heater.js**
  
- Poi apri un secondo terminale senza chiudere quello di prima e fai: **node dist/things/sensors.js**
- Poi apri un terzo terminale senza chiudere quello di prima e fai: **node dist/heating-logic.js**
- Poi direttamente dalla cartella apri il file **dashboard.html**

### macOS
- Installa Nodejs
- Da terminale digita: **brew install mosquitto**
- Avvia il broker Mosquitto: **brew services start mosquitto**
- Vai su visual studio code, apri il progetto e da terminale fai:
  
  • **npm install**

  • **npx tsc**
  
  • **node dist/things/heater.js**
  
- Poi apri un secondo terminale senza chiudere quello di prima e fai: **node dist/things/sensors.js**
- Poi apri un terzo terminale senza chiudere quello di prima e fai: **node dist/heating-logic.js**
- Poi direttamente dalla cartella apri il file **dashboard.html**
