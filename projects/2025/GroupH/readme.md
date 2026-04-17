# Termostato Smart - Progetto Universitario

Author: Naman Bagga, Salvatore Persico

Corso: Laboratorio di piattaforme di sviluppo per automazione

Date: 17/04/2026

## Descrizione del progetto

Questo progetto implementa un termostato intelligente per valvole di radiatori basato su architettura IoT e comunicazione MQTT.

Il sistema consente di:

- Monitorare la temperatura di più ambienti
- Impostare setpoint per stanza o valvola
- Applicare override manuali temporanei
- Visualizzare stato e storico tramite dashboard web

Il progetto è progettato per scopi didattici, con un’architettura semplice ma realistica.

## Architettura 

Il sistema è composto dai seguenti componenti:

- Broker MQTT (esterno): Gestisce la comunicazione tra dispositivi (es. Mosquitto su localhost:1883)

- Controller (Node.js + TypeScript):
    - Riceve dati di temperatura
    - Applica logica di controllo (isteresi + override)
    - Invia comandi alle valvole

- API / Dashboard (Express):
    - Espone API REST
    - Serve una dashboard web per il controllo del sistema

- Simulatore Valvole (Node.js):
    - Emula dispositivi reali
    - Pubblica temperatura
    - Riceve comandi

- Database (SQLite): Memorizza valvole, stanze, temperature e override

- Layer WoT (node-wot): Rappresenta le valvole come “Thing” interoperabili

## Flusso dei dati

[valvole/simulatore] -> MQTT -> [controller] -> [database] -> [express] -> [dashboardWeb]

## Tecnologie utilizzate

- Backend:
    - Node.js
    - TypeScript
    - Express
    - MQTT
    - SQlite

- Frontend:
    - HTML
    - CSS (Bootstrap)
    - JS (JavaScript)
    - Chart.js

- Comunicazione: 
    - node-wot

