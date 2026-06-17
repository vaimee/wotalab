🚀 Smart Home Security System

Progetto per il corso di Automazione – Università di Bologna (Unibo)

📌 Descrizione

Sistema di sicurezza domestico simulato basato su Web of Things (WoT).

Componenti:

sensori (porta, finestra, movimento)
orchestratore centrale
dashboard web
⚙️ Comunicazione
MQTT (1883) → eventi tra sensori e orchestratore
HTTP (3000) → Thing Descriptions + dashboard
WebSocket (3000) → aggiornamenti real-time UI
📁 Repository
src/index.js → bootstrap sistema (Express + MQTT + WS)
src/orchestrator/ → logica di controllo eventi
src/things/ → sensori e attuatori WoT
public/ → dashboard web
RELAZIONE_PROGETTO.md → documentazione tecnica
🧰 Requisiti
Node.js ≥ 18
npm
▶️ Avvio
npm install
npm start

Apri:

http://localhost:3000
🔄 Funzionamento
sensori pubblicano eventi su MQTT
orchestratore elabora eventi
attiva allarmi/notifiche
dashboard aggiorna UI via WebSocket