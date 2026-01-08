# Progetto
## Gestione intelligente di una stanza tramite Web of Things


## Partecipanti  
**Gruppo:** C  

- Alex Cambrini - alex.cambrini@studio.unibo.it
- Lorenzo Ferrari - lorenzo.ferrari27@studio.unibo.it

---

## Idea generale del progetto  
Il progetto ha come obiettivo la realizzazione di un sistema **Web of Things (WoT)** per il monitoraggio e la gestione intelligente di una singola stanza, con particolare attenzione al **comfort ambientale** e alla **riduzione degli sprechi energetici**.

L’idea è modellare i principali elementi della stanza come **Thing WoT**, descritte tramite un modello semantico, che permetta di osservare lo stato dell’ambiente e di attuare semplici azioni automatiche in base a regole predefinite.

---

## Contesto e scenario  
Il sistema rappresenta una stanza (ad esempio aula, ufficio o camera) dotata di sensori ambientali e di un attuatore, in grado di reagire a variazioni di:
- temperatura e umidità
- luminosità
- presenza di persone
- stato di apertura di una finestra

Queste informazioni vengono utilizzate per prendere decisioni automatiche, simulando una gestione intelligente dell’energia all’interno dell’ambiente.

---

## Thing WoT previste  
Il progetto prevede la creazione delle seguenti Thing:

- **Sensore di temperatura e umidità**  
  Rappresenta le condizioni termiche e di comfort della stanza.

- **Sensore di luminosità**  
  Fornisce informazioni sulla luce ambientale naturale o artificiale.

- **Sensore di presenza**  
  Indica se la stanza è occupata o meno.

- **Sensore di stato finestra**  
  Indica se una finestra è aperta o chiusa, informazione utile per la gestione energetica.

- **Attuatore (relè)**  
  Permette di simulare l’accensione o lo spegnimento di un dispositivo (ad esempio luce, riscaldamento o ventilazione).

---

## Relazioni e logica di funzionamento  
Le Thing sono collegate tra loro tramite **regole logiche**, che permettono al sistema di reagire in modo automatico alle condizioni dell’ambiente. Alcuni esempi di relazioni tra i dati raccolti:

- **Presenza e illuminazione**  
  In presenza di persone e con un basso livello di luminosità, il sistema può attivare l’attuatore per accendere la luce.  
  In assenza di presenza, le luci vengono spente per ridurre i consumi.

- **Presenza e temperatura**  
  Le azioni legate al comfort termico vengono considerate solo quando la stanza è occupata, evitando sprechi energetici quando è vuota.

- **Finestra e gestione energetica**  
  Se una finestra risulta aperta, il sistema può disattivare dispositivi come il riscaldamento o la ventilazione, oppure evitare che vengano attivati.

- **Umidità e aerazione**  
  Valori elevati di umidità, combinati con lo stato della finestra, possono influenzare le decisioni del sistema, suggerendo o simulando azioni di ventilazione.

---
