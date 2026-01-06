# Sistema di Irrigazione Intelligente (Progetto)

## Introduzione

Questo progetto ha l’obiettivo di _progettare e realizzare un sistema di irrigazione intelligente_ basato sui principi del *Web of Things (WoT), nell’ambito del corso di *Laboratorio Piattaforme e Sviluppo per l'Automazione.

Il sistema è pensato per simulare un contesto reale di automazione IoT, in cui sensori e attuatori cooperano tramite servizi web standardizzati.

## Obiettivo del Progetto

L’obiettivo principale è sviluppare una piattaforma che:

- monitori parametri ambientali rilevanti per l’irrigazione;
- decida automaticamente quando irrigare in base a regole predefinite;
- consenta il controllo e il monitoraggio del sistema tramite un’interfaccia web.

Il progetto mira a dimostrare l’utilizzo degli _standard WoT del W3C_ per descrivere, esporre e orchestrare dispositivi IoT.

## Funzionalità Previste

Il sistema prevede:

- _Sensori simulati_:

  - sensore di umidità del terreno;
  - sensore di luminosità ambientale.

- _Attuatore_:

  - pompa di irrigazione controllabile via rete.

- _Logica di controllo centrale_:

  - gestione della modalità automatica di irrigazione;
  - coordinamento tra sensori e attuatori.

- _Interfaccia Web_:

  - visualizzazione dei dati dei sensori;
  - controllo manuale dell’irrigazione;
  - configurazione dei parametri principali.

## Architettura Generale

Il sistema è strutturato secondo un’architettura client–server:

- _Backend_ basato su Node.js che espone i dispositivi come Thing WoT tramite API HTTP;
- _Frontend Web_ accessibile da browser per il monitoraggio e il controllo del sistema;
- _Comunicazione real-time_ tra backend e frontend per aggiornare lo stato del sistema.

## Tecnologie Utilizzate

- _Node.js_ e _TypeScript_ per il backend;
- _node-wot_ per l’implementazione degli standard Web of Things;
- _HTML, CSS e JavaScript_ per la dashboard web;
- _HTTP e WebSocket_ per la comunicazione.

## Scopo Didattico

Il progetto ha finalità esclusivamente _didattiche_ e utilizza sensori simulati.
L’obiettivo è acquisire competenze su:

- progettazione di sistemi IoT;
- utilizzo degli standard WoT;
- sviluppo di applicazioni web per l’automazione;
- integrazione tra frontend e backend in tempo reale.

## Sviluppato da:

- Alessandro Rambaldi (alessandro.rambaldi@studio.unibo.it)
- Antonino Cardillo (antonino.cardillo2@studio.unibo.it)
- Nicolae Balaban (nicolae.balaban@studio.unibo.it)

---
