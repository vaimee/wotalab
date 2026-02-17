# Progetto WoT - Riscaldamento automatizzato

### Obiettivo del progetto

L'obiettivo del progetto è avere sensori di temperatura in più stanze, esposti come “Things” WoT, in modo che client WoT possano leggere i dati, ricevere eventi e controllare il riscaldamento in modo standardizzato.


### Funzionalità previste

- Monitoraggio in tempo reale della temperatura in ogni stanza

- Controllo del riscaldamento tramite impostazione della temperatura desiderata.

- Notifica di eventi quando si cambia la temperatura desiderata in ogni stanza.

- Automazione semplice del riscaldamento in base ai valori misurati. Ogni stanza ha un termostato che si accende/spegne in base alla temperatura.


### Architettura del sistema

- **Things** (dispositivi WoT)

  - Sensori di temperatura (uno per stanza).

  - Sistema di riscaldamento (attuatore).

- **Client WoT**

  - Dashboard web per visualizzazione e controllo delle temperature

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

  - temperature change : quando si cambia una temperatura desiderata in una stanza.
    

 ### Comunicazione

- Protocolli Web: HTTP e MQTT

- I client WoT interagiscono leggendo le Thing Description, scoprendo automaticamente le funzionalità dei dispositivi


### Tecnologie utilizzate

- Backend / Things: Node.js, node-wot, Typescript

- Frontend: HTML, CSS, Javascript

- Protocolli: HTTP, MQTT


### Componenti del gruppo:

Giannini Matteo - matteo.giannini3@studio.unibo.it

Filippo Forcellini - filippo.forcellini@studio.unibo.it
