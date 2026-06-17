# Relazione di Progetto: Smart Home Security System (WoT)

**Corso di Automazione**  
**Alma Mater Studiorum - Università di Bologna**

---

## 1. Introduzione

Il presente documento descrive l'architettura e l'implementazione di un sistema di sicurezza per una Smart Home, progettato secondo i principi del **Web of Things (WoT)**. L'obiettivo principale è la realizzazione di una rete di dispositivi simulati interconnessi, in grado di comunicare in tempo reale il proprio stato a un orchestratore centrale, il quale a sua volta coordina la logica di allarme e notifica.

Il paradigma WoT è stato applicato fornendo per ogni dispositivo (Thing) una **Thing Description (TD)** esposta tramite API HTTP REST, descrivendo così metadati, proprietà, azioni ed eventi dei singoli componenti.

## 2. Architettura del Sistema

L'architettura proposta si basa su un modello ibrido client-server e pub/sub, sfruttando una singola istanza Node.js che gestisce sia il layer HTTP che il broker MQTT.

I componenti principali del sistema sono:

1. **Thing (Sensori e Attuatori)**: Entità logiche che simulano dispositivi fisici (sensore porta, sensore finestra, sensore di movimento, sirena di allarme e servizio notifiche).
2. **Orchestrator**: Il nodo centrale che esegue la logica applicativa. Si iscrive ai topic MQTT per ricevere eventi, mantiene lo stato del sistema e comanda gli attuatori (es. trigger allarme).
3. **Broker MQTT**: Gestisce il routing dei messaggi (pub/sub) tra le Thing e l'Orchestrator. Implementato tramite libreria `aedes`.
4. **Server HTTP / API REST**: Fornisce l'accesso alle Thing Descriptions e permette di invocare azioni tramite chiamate POST.
5. **WebSocket Server**: Stabilisce una connessione persistente con il client web (Dashboard) per l'inoltro in tempo reale di eventi loggati e variazioni di stato.
6. **Dashboard (Web UI)**: Interfaccia utente in HTML/CSS/JS per il monitoraggio e controllo dell'impianto.

## 3. Protocolli di Comunicazione

Il sistema utilizza tre protocolli principali, scelti in base alle specifiche esigenze funzionali:

- **MQTT (Porta 1883)**: Scelto per la sua leggerezza e per il modello Publisher/Subscriber. I sensori pubblicano eventi (es. `events/door-sensor/doorOpened`) senza dover conoscere l'indirizzo del destinatario, garantendo un forte disaccoppiamento tra produttori di dati e logica di controllo.
- **HTTP (Porta 3000)**: Utilizzato per esporre le interfacce WoT (Thing Descriptions su `/things/*/td`) e per il controllo esplicito degli attuatori tramite metodi standard (es. attivazione allarme via HTTP POST). L'utilizzo di REST garantisce l'interoperabilità del sistema.
- **WebSocket (Porta 3000)**: Introdotto per superare le limitazioni di latenza intrinseche al polling HTTP. Permette una comunicazione full-duplex, essenziale per una dashboard di sicurezza dove il feedback istantaneo (< 200ms) è un requisito non funzionale primario.

## 4. Dettaglio dei Componenti

### 4.1. I Sensori (Publishers)
Ogni sensore è implementato come una classe Javascript che estende un'astrazione WoT.
- **DoorSensor / WindowSensor**: Simulano l'apertura e chiusura casuale degli infissi.
- **MotionSensor**: Simula il rilevamento periodico di movimento.
Questi componenti, oltre ad esporre proprietà tramite HTTP, pubblicano messaggi MQTT con payload JSON quando il loro stato interno muta.

### 4.2. L'Orchestratore (Subscriber / Controller)
L'Orchestrator rappresenta il "cervello" della Smart Home. All'avvio, esegue la *subscription* ai topic degli eventi dei sensori. 
La logica di sicurezza prevede due stati: `Away Mode` (modalità sicurezza attiva) o inattivo. 
Se rileva un'apertura di porta/finestra mentre la sicurezza è attiva, l'Orchestrator interviene autonomamente invocando i metodi del componente `AlarmSystem` e propagando un alert tramite `NotificationService`. Inoltre, utilizza un callback WebSocket per eseguire il broadcast immediato dell'allarme a tutti i client web connessi.

### 4.3. L'Interfaccia Utente (Dashboard)
Una Single Page Application (SPA) semplice, servita direttamente da Express. Il client Javascript instanzia una connessione WebSocket con il server.
Ad ogni aggiornamento (`sensor_update`, `alert`, `security_mode_changed`), l'interfaccia si aggiorna dinamicamente modificando le classi CSS (es. per l'animazione *pulse* degli allarmi) senza ricaricare la pagina.

## 5. Verifica e Collaudo

Il collaudo funzionale ha confermato il rispetto dei requisiti:
1. **Discoverability**: Le Web Thing Descriptions risultano correttamente accessibili via GET.
2. **Reattività**: Grazie all'accoppiata MQTT-WebSocket, il ritardo tra l'evento simulato e la visualizzazione su browser risulta trascurabile all'occhio umano.
3. **Robustezza Logica**: L'Orchestratore gestisce in modo deterministico lo stato `securityMode`, evitando la propagazione di allarmi qualora il sistema sia disarmato.

## 6. Conclusioni

L'infrastruttura implementata dimostra la validità del paradigma Web of Things per l'integrazione di sistemi IoT eterogenei. L'utilizzo di interfacce HTTP basate su URI fornisce discoverability, mentre MQTT garantisce efficienza nel dispacciamento asincrono. L'integrazione di WebSocket si è rivelata determinante per elevare la Quality of Experience (QoE) dell'interfaccia utente, portando il sistema in linea con gli standard applicativi moderni per il monitoraggio industriale e domotico in tempo reale.
