# Smart Home Security System

**Progetto per il corso di Automazione - Università di Bologna (Unibo)**

## Descrizione del Progetto

Il progetto consiste nella progettazione e sviluppo di un sistema di sicurezza domestico simulato, basato sul paradigma **Web of Things (WoT)**. L'architettura prevede la comunicazione in tempo reale tra un set di sensori simulati (porta, finestra, movimento), un orchestratore centrale e un'interfaccia utente web-based.

L'infrastruttura di comunicazione sfrutta:
- **MQTT (Porta 1883)**: per lo scambio di messaggi telemetrici e comandi tra i sensori/attuatori e l'orchestratore centrale.
- **HTTP (Porta 3000)**: per servire l'interfaccia di monitoraggio (Dashboard) ed esporre le Web Thing Descriptions.
- **WebSocket (Porta 3000)**: per il trasferimento dati bidirezionale in tempo reale verso il client, garantendo un aggiornamento istantaneo dell'interfaccia grafica.

## Struttura della Repository

- `src/index.js`: Entry point dell'applicazione. Inizializza il broker MQTT, il server Express e i WebSocket.
- `src/orchestrator/`: Contiene la logica di controllo (Orchestratore) che analizza gli eventi e determina lo stato del sistema.
- `src/things/`: Implementazione dei dispositivi WoT (DoorSensor, WindowSensor, MotionSensor, AlarmSystem, NotificationService).
- `public/`: Contiene le risorse statiche (HTML, CSS, JS) per la Dashboard.
- `RELAZIONE_PROGETTO.md`: Documentazione tecnica di dettaglio e scelte progettuali.

## Requisiti di Sistema

- **Node.js** (versione consigliata: 18.x o superiore)
- **npm** (Node Package Manager)

## Istruzioni di Avvio

1. Clona la repository o accedi alla directory del progetto.
2. Installa le dipendenze necessarie eseguendo:
   ```bash
   npm install
   ```
3. Avvia il sistema:
   ```bash
   npm start
   ```
4. Accedi alla Dashboard aprendo un browser web al seguente indirizzo:
   ```
   http://localhost:3000
   ```

## Note sull'Esecuzione

Una volta avviato, il sistema simulerà la pubblicazione periodica di eventi da parte dei sensori sul broker MQTT locale. Tali eventi verranno intercettati dall'orchestratore, il quale aggiornerà lo stato del sistema e inoltrerà i dati alla dashboard tramite connessione WebSocket per la visualizzazione immediata.
