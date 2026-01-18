# Lumo Pasos — Sistema di Illuminazione Ambientale Intelligente (Progetto)

## Introduzione

Lumo Pasos è un sistema per la gestione intelligente dell’illuminazione ambientale basato sui principi del Web of Things (WoT).

Il progetto integra sensori, attuatori e un orchestratore centrale che consente di regolare luminosità e temperatura colore delle luci in:

- modalità manuale
- modalità automatica con compensazione della luce ambientale

---

## Obiettivo del Progetto

L’obiettivo del progetto è realizzare una piattaforma WoT capace di:

- controllare i parametri delle lampade;
- analizzare l’illuminazione ambientale tramite webcam;
- adattare automaticamente la luce per mantenere valori desiderati;
- consentire il controllo manuale tramite interfaccia web.

---

## Funzionalità Previste

Il sistema include i seguenti componenti.

### Things (uno per ogni membro del gruppo):

### Thing 1 – Lampada Intelligente (Attuatore)

Proprietà esposte:

- luminosità
- temperatura colore

Funzioni:

- regolazione manuale
- regolazione remota tramite orchestratore

Protocolli supportati:

- HTTP
- MQTT

---

### Thing 2 – Sensore Ambientale RGB (Webcam)

Funzioni:

- acquisizione immagini dell’ambiente
- calcolo del colore medio (valori R / G / B)
- invio periodico dei dati all’orchestratore

Esposto come Thing WoT tramite:

- REST (HTTP)
- MQTT

---

### Thing 3 – Controller MQTT

Responsabilità:

- ricezione dei comandi di regolazione
- inoltro dei valori alle lampade
- pubblicazione dello stato del sistema

Funziona come nodo intermedio tra orchestratore e attuatori.

---

## Orchestratore del Sistema

L’orchestratore implementa la logica applicativa del sistema:

- coordina lampada e sensore
- confronta valori desiderati e valori reali
- applica la compensazione luminosa
- gestisce le modalità operative

### Modalità Manuale

L’utente imposta direttamente:

- luminosità
- temperatura colore

I valori vengono inviati alla lampada tramite MQTT/HTTP.

### Modalità Automatica

- la webcam misura il colore medio dell’ambiente
- l’orchestratore calcola la correzione necessaria
- la lampada viene regolata dinamicamente

Nel caso in cui il valore richiesto non sia ottenibile
(es. ambiente troppo luminoso rispetto al target)
viene applicata un’approssimazione al valore più vicino possibile.

---

## Architettura Generale

Il sistema adotta un’architettura client–server–Things composta da:

### Server Flask (Orchestratore WoT)

- gestisce la logica applicativa
- espone le Thing Description
- coordina sensore e attuatore

### Broker MQTT (Mosquitto)

- gestione della comunicazione tra Things
- scambio di messaggi in tempo reale

### Interfaccia Web

- modalità manuale con slider
- modalità automatica con input dei valori target
- feedback dello stato del sistema

Ogni TD espone:

- binding HTTP
- binding MQTT
---

## Tecnologie Utilizzate

- Flask — backend e orchestratore WoT  
- Paho MQTT — client MQTT  
- Mosquitto — broker MQTT  
- HTML5, CSS3, Bootstrap — interfaccia web  
- Node.js e TypeScript per il backend;
---
## Scopo Didattico
consente di sperimentare:

- progettazione di sistemi IoT
- utilizzo degli standard Web of Things
- modellazione di Things tramite TD
- orchestrazione di sensori e attuatori
- integrazione tra MQTT e HTTP
- sviluppo di interfacce web per sistemi automatici

---

## Sviluppato da

- Alessandro Dominici
- Jacopo Spitaleri
- Mactar Seck Ibrahima
