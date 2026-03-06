const HEATER_URL = 'http://localhost:8080/heatingsystem';
const ROOMS = [
    { name: 'Cucina', port: 8081 },
    { name: 'Camera', port: 8082 },
    { name: 'Bagno', port: 8083 }
];

// Aggiunge un evento alla sezione eventi
function addEvent(message) {
    const eventsDiv = document.getElementById('events'); 
    const noEvents = eventsDiv.querySelector('.no-events'); 
    if (noEvents) noEvents.remove();

    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    const timestamp = new Date().toLocaleTimeString(); //Aggiunge l'ora all'evento
    eventItem.textContent = `[${timestamp}] ${message}`; //Formatta il messaggio con l'ora
    eventsDiv.insertBefore(eventItem, eventsDiv.firstChild); //inserisce il nuovo evento in cima alla lista

    if (eventsDiv.children.length > 10) { 
        eventsDiv.removeChild(eventsDiv.lastChild); //Rimuove l'evento più vecchio se ci sono più di 10 eventi
    }
}

async function setTarget(roomName) { //imposta la temperatura target per una stanza specifica
    const targetTemp = parseFloat(document.getElementById(`target${roomName}`).value); //prende il valore inserito dall'utente
    const room = ROOMS.find(r => r.name === roomName); //trova la stanza corrispondente nell'array ROOMS

    try {
        await fetch(`http://localhost:${room.port}/sensor${roomName.toLowerCase()}/actions/setTargetTemperature`, { //invia una richiesta POST al sensore della stanza per impostare la temperatura target
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: targetTemp.toString()
        });
        addEvent(`${roomName} - Temperatura target: ${targetTemp}°C`); //aggiunge un evento alla sezione eventi indicando la nuova temperatura target impostata
    } catch (error) {
        console.error('Errore:', error);
    }
}

async function updateDashboard() { //aggiorna i dati visualizzati sulla dashboard
    try {
        for (const room of ROOMS) {
            const tempResponse = await fetch(`http://localhost:${room.port}/sensor${room.name.toLowerCase()}/properties/temperature`); //invia una richiesta GET al sensore della stanza per ottenere la temperatura attuale
            const temp = await tempResponse.json(); //prende la temperatura attuale dalla risposta
            document.getElementById(`temp${room.name}`).textContent = temp.toFixed(1); //aggiorna il testo dell'elemento HTML corrispondente alla temperatura della stanza con il valore ottenuto

            const valveResponse = await fetch(`http://localhost:${room.port}/sensor${room.name.toLowerCase()}/properties/isValveOpen`); //invia una richiesta GET al sensore della stanza per verificare se la valvola è aperta
            const isValveOpen = await valveResponse.json(); //prende lo stato della valvola dalla risposta
            const valveSpan = document.getElementById(`valve${room.name}`); //seleziona l'elemento HTML corrispondente alla valvola della stanza

            if (isValveOpen) { //valvola aperta
                valveSpan.textContent = 'Attivo';
                valveSpan.className = 'active';
            } else { //valvola chiusa
                valveSpan.textContent = 'Inattivo';
                valveSpan.className = '';
            }
        }

        const isOnResponse = await fetch(`${HEATER_URL}/properties/isOn`); //invia una richiesta GET al sistema di riscaldamento per verificare se è acceso
        const isOn = await isOnResponse.json(); //prende lo stato del sistema di riscaldamento dalla risposta
        const statusSpan = document.getElementById('heaterStatus'); 

        if (isOn) { //sistema di riscaldamento acceso
            statusSpan.textContent = 'Acceso';
            statusSpan.className = 'on';
        } else { //sistema di riscaldamento spento
            statusSpan.textContent = 'Spento';
            statusSpan.className = '';
        }
    } catch (error) {
        console.error('Errore:', error);
    }
}

//limita input a un solo decimale
document.querySelectorAll('input[type="number"]').forEach(input => { 
    input.addEventListener('input', function(e) {
        const value = e.target.value;
        if (value.includes('.')) {
            const parts = value.split('.');
            if (parts[1] && parts[1].length > 1) {
                e.target.value = parseFloat(value).toFixed(1);
            }
        }
    });
});

setInterval(updateDashboard, 2000);
updateDashboard();
addEvent('Dashboard avviata');
