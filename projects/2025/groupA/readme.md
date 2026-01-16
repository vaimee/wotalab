# Riscaldamento automatizzato ( :white_check_mark: APPROVATO)

### Obiettivo del progetto

L'obiettivo del progetto è avere sensori di temperatura in più stanze, esposti come “Things” WoT, in modo che client WoT possano leggere i dati, ricevere eventi e controllare il riscaldamento in modo standardizzato.


### Funzionalità previste

- Monitoraggio in tempo reale della temperatura in ogni stanza.

- Visualizzazione dello storico delle temperature.

- Notifica di eventi quando la temperatura supera o scende sotto una soglia.

- Controllo del riscaldamento tramite impostazione della temperatura desiderata.

- Automazione semplice del riscaldamento in base ai valori misurati.


### Architettura del sistema

- **Things** (dispositivi WoT)

  - Sensori di temperatura (uno per stanza).

  - Sistema di riscaldamento (attuatori).

- **Client WoT**

  - Dashboard web per visualizzazione e controllo

  - Motore di automazione per applicare le regole (decide cosa fare in base ai dati dei sensori)

  - Visualizzazione in tempo reale dei valori e degli eventi


Ogni Thing espone una Thing Description (TD) che definisce:

- **Properties**

  - temperature: (temperatura attuale della stanza)

  - targetTemperature: (temperatura desiderata che si vuole far raggiungere alla stanza)

  Se temperature < targetTemperature → accende il riscaldamento.

  Se temperature ≥ targetTemperature → spegne il riscaldamento.

- **Actions**

  - setTargetTemperature(x): è l’azione che permette di modificare targetTemperature

  - turnOn(), turnOff() : accende e spegne il riscaldamento

- **Events**

  - temperatureHigh: quando la temperatura supera una soglia massima definita

  - temperatureLow: quando la temperatura scende sotto una soglia minima definita
    


 ### Comunicazione

- Protocolli Web: HTTP e MQTT

- I client WoT interagiscono leggendo le Thing Description, scoprendo automaticamente le funzionalità dei dispositivi


### Tecnologie utilizzate

- Backend / Things: Node.js, node-wot

- Frontend: HTML, CSS, Javascript

- Protocolli: HTTP, MQTT


### Componenti del gruppo:

Giannini Matteo - matteo.giannini3@studio.unibo.it

Filippo Forcellini - filippo.forcellini@studio.unibo.it
