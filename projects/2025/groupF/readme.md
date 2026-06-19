# 🌿 WoT Smart Greenhouse

![Status](https://img.shields.io/badge/Status-Proposta_di_Progetto-yellow)
![Corso](https://img.shields.io/badge/Corso-Web_of_Things-blue)

Progetto per il corso di Laboratorio di Piattaforme di Sviluppo per Automazione - Università degli Studi di Bologna.

## 👥 Partecipanti
| Gruppo  | Email |
| :--- | :--- |
| Matteo Aloè | m.aloe3@studio.unibo.it |
| Elia Strazzella | elia.strazzella@studio.unibo.it |


---

## 🎯 Obiettivo del Progetto

Il progetto ha l'obiettivo di progettare e realizzare un ecosistema **Web of Things (WoT)** per il monitoraggio e la gestione automatizzata di una serra intelligente (Smart Greenhouse). 

L'applicativo simula un contesto IoT realistico in cui dispositivi eterogenei comunicano tramite protocolli differenti (MQTT, HTTP) e vengono orchestrati in un ambiente centralizzato. Il focus principale è la stretta aderenza agli standard W3C, con particolare attenzione a:
* Utilizzo di **Thing Description (TD)**.
* Annotazione semantica dei dispositivi.
* Impiego delle **WoT Scripting API** per l'orchestrazione (Mashup).
* Implementazione di logiche di sicurezza base.

---

## 🔌 Dispositivi (Thing WoT) Previsti

Il sistema prevede la modellazione di quattro dispositivi principali, esposti come *Thing*:

### 1. Sensore Ambientale Multiplo (Producer)
* **Descrizione:** Simula la lettura combinata di *temperatura* dell'aria e *umidità* del terreno.
* **Protocollo:** Pubblica i dati periodicamente tramite **MQTT**.

### 2. Sensore di Luminosità (Producer)
* **Descrizione:** Rileva l'intensità della luce solare/artificiale.
* **Protocollo:** Espone lo stato tramite polling **HTTP**.

### 3. Pompa di Irrigazione (Actuator)
* **Descrizione:** Simula una valvola per l'irrigazione del terreno.
* **Protocollo:** Espone un'azione (Action) via **HTTP**. 
* **Sicurezza:** Endpoint protetto tramite **API Key**.

### 4. Sistema di Ventilazione (Actuator)
* **Descrizione:** Simula una ventola di estrazione per abbassare la temperatura interna.
* **Protocollo:** Espone un'azione via **HTTP**.

---

## 🧠 Logica di Mashup e Orchestrazione

Le Thing non comunicano direttamente tra loro, ma sono gestite da un **Gateway / Orchestrator (Consumer)**. L'orchestratore consuma le Thing Description, si iscrive agli eventi MQTT e interpella gli endpoint HTTP, applicando le seguenti regole:

1. **Controllo Idrico:** Se l'umidità del terreno scende sotto il 30% e la luminosità indica che è giorno, il Gateway invia una richiesta HTTP (autenticata) per azionare la Pompa di Irrigazione.
2. **Controllo Termico:** Se la temperatura supera i 35°C, il Gateway aziona il Sistema di Ventilazione per preservare le colture.

---

## 🌐 Modellazione Semantica e Interoperabilità

Ogni dispositivo è descritto rigorosamente tramite un file `.tm.json` (Thing Description in JSON-LD). Per garantire interoperabilità e aderenza agli standard, le TD sono annotate semanticamente utilizzando:
* **SOSA/SSN:** Per definire il ruolo del nodo (`sosa:Sensor` o `sosa:Actuator`) e qualificare le `sosa:Observation`.
* **QUDT:** Per standardizzare le unità di misura (es. `unit:DEG_C` per la temperatura, percentuali per l'umidità).

---

## 🏗️ Architettura del Sistema

```text
┌────────────────────────────────────────────────────────────┐
│                    WoT Orchestrator (Gateway)              │
│ ┌────────────────┐  ┌──────────────────┐ ┌───────────────┐ │
│ │ TD Consumer    │  │ Mashup Logic     │ │ API Key Mgmt  │ │
│ └───────┬────────┘  └────────┬─────────┘ └───────┬───────┘ │
└─────────┼────────────────────┼───────────────────┼─────────┘
          │                    │                   │
  (Sub)   │ MQTT               │ HTTP (GET)        │ HTTP (POST + API Key)
          ▼                    ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Mosquitto Broker │ │ Sensore Luce     │ │ Attuatori        │
│ ┌──────────────┐ │ │ (Thing HTTP)     │ │ - Pompa Acqua    │
│ │ Sensore      │ │ │                  │ │ - Ventola        │
│ │ Temp/Umidità │ │ │                  │ │                  │
│ └──────────────┘ │ └──────────────────┘ └──────────────────┘
└──────────────────┘
