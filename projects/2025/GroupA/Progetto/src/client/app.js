const HEATER_URL = 'http://localhost:8080/heatingsystem';
const ROOMS = [
    { name: 'Cucina', port: 8081 },
    { name: 'Camera', port: 8082 },
    { name: 'Bagno', port: 8083 }
];

function addEvent(message) {
    const eventsDiv = document.getElementById('events');
    const noEvents = eventsDiv.querySelector('.no-events');
    if (noEvents) noEvents.remove();

    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    const timestamp = new Date().toLocaleTimeString();
    eventItem.textContent = `[${timestamp}] ${message}`;
    eventsDiv.insertBefore(eventItem, eventsDiv.firstChild);

    if (eventsDiv.children.length > 10) {
        eventsDiv.removeChild(eventsDiv.lastChild);
    }
}

async function setTarget(roomName) {
    const targetTemp = parseFloat(document.getElementById(`target${roomName}`).value);
    const room = ROOMS.find(r => r.name === roomName);

    try {
        await fetch(`http://localhost:${room.port}/sensor${roomName.toLowerCase()}/actions/setTargetTemperature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: targetTemp.toString()
        });
        addEvent(`${roomName} - Temperatura target: ${targetTemp}°C`);
    } catch (error) {
        console.error('Errore:', error);
    }
}

async function updateDashboard() {
    try {
        for (const room of ROOMS) {
            const tempResponse = await fetch(`http://localhost:${room.port}/sensor${room.name.toLowerCase()}/properties/temperature`);
            const temp = await tempResponse.json();
            document.getElementById(`temp${room.name}`).textContent = temp.toFixed(1);

            const valveResponse = await fetch(`http://localhost:${room.port}/sensor${room.name.toLowerCase()}/properties/isValveOpen`);
            const isValveOpen = await valveResponse.json();
            const valveSpan = document.getElementById(`valve${room.name}`);

            if (isValveOpen) {
                valveSpan.textContent = 'Attivo';
                valveSpan.className = 'active';
            } else {
                valveSpan.textContent = 'Inattivo';
                valveSpan.className = '';
            }
        }

        const isOnResponse = await fetch(`${HEATER_URL}/properties/isOn`);
        const isOn = await isOnResponse.json();
        const statusSpan = document.getElementById('heaterStatus');

        if (isOn) {
            statusSpan.textContent = 'Acceso';
            statusSpan.className = 'on';
        } else {
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
