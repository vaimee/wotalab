let soilSensor, lightSensor, irrigationSystem, smartLamp;
let isPumpOn = false;
let isLampOn = false;

// Temporizzatori per evitare conflitti visivi tra click manuali e aggiornamenti automatici
// Memorizzano il timestamp (in millisecondi) dell'ultima volta in cui l'utente ha cliccato i toggle.
let lastPumpActionTime = 0;
let lastLampActionTime = 0;

//la segunente funzione cerca nella pagina html l'elemento con id log e se esiste 
function updateLog(msg) {
    const logElement = document.getElementById('log');
    if (logElement) {
        const timestamp = new Date().toLocaleTimeString(); //ne prende l'orario 
        const entry = document.createElement('div');    //crea un div vuoto in memoria 
        entry.innerText = `[${timestamp}] ${msg}`;  //inserisce nel div il testo con l'orario e il messaggio
        logElement.prepend(entry);  //prepend permette di far apparire i messaggi più recenti in cima
    }
    console.log(msg);
}

//la seguente funzione prende il nome della pianta selezionata dalla query string dell'URL
function getSelectedPlantName() {
    const params = new URLSearchParams(window.location.search);
    return params.get('name') || 'Pianta selezionata';
}

//la seguente funzione si occupa di inizializzare la pagina, impostare il nome della pianta, caricare l'immagine corretta e connettersi ai dispositivi WoT
async function init() {
    const plantName = getSelectedPlantName(); //legge l'url della pianta selezionata e ne prende il nome
    document.getElementById('plant-name').innerText = plantName;
    document.title = `Smart Plant - ${plantName}`;

    // Immagine della pianta impostat dinamicamente a seconda di quele pinata si seleziona
    const plantImg = document.getElementById('plant-img');
    if (plantImg) {
        const imageName = plantName.toLowerCase().replace(/\s+/g, '-');
        plantImg.src = `/img/${imageName}.png`;
        plantImg.classList.remove('hidden');
    }

    //Prima di provare a connettersi ai dispositivi, verifica che la libreria WoT sia stata caricata correttamente
    const WoTBundle = window.WoT;
    if (!WoTBundle) {
        updateLog('❌ Errore: libreria WoT non caricata.');
        return;
    }

    try {
        updateLog('Inizializzazione Servient...');
        const servient = new WoTBundle.Core.Servient(); //si crea un servient, che è l'entità che gestisce la comunicazione con i dispositivi WoT
        servient.addClientFactory(new WoTBundle.Http.HttpClientFactory()); //lo si configura per parlafe con i componennti tramite HTTP
        const wotFactory = await servient.start(); //si avvia il servient e si ottiene una factory per consumare i dispositivi WoT
        updateLog('Connessione ai dispositivi...');

        //usa fetch per trovare i sensori e attuatori disponibili sui server locali
        const tdSoil = await fetch('http://localhost:8081/soilmoisturesensor').then(r => r.json());
        const tdLight = await fetch('http://localhost:8081/lightsensor').then(r => r.json());
        const tdIrr = await fetch('http://localhost:8082/irrigationsystem').then(r => r.json());
        const tdLamp = await fetch('http://localhost:8082/smartlamp').then(r => r.json());

        //consume, prende tdsoil, tdlight, tdIrr e tdLamp e crea oggetti javascript che rappresentano i dispositivi WoT, permettendo di interagire con loro tramite le loro proprietà e azioni
        soilSensor = await wotFactory.consume(tdSoil);
        lightSensor = await wotFactory.consume(tdLight);
        irrigationSystem = await wotFactory.consume(tdIrr);
        smartLamp = await wotFactory.consume(tdLamp);

        updateLog(`✅ Sistema sincronizzato per ${plantName}`);

        //permette di aggiornare ogni 3 secondi i valori di umidità e luce, e di fornire consigli su quando accendere o spegnere la pompa e la lampada
        setInterval(async () => {
            try {
                //soilsensor ha una proprietà chiamata moisture, che rappresenta l'umidità del terreno. 
                // La funzione readProperty legge il valore attuale di questa proprietà, e value() restituisce il valore numerico dell'umidità
                const mRes = await soilSensor.readProperty('moisture');
                const mVal = await mRes.value();
                // Aggiorna il testo dell'elemento con id m-val per mostrare l'umidità attuale formattata con una cifra decimale e un simbolo di percentuale
                document.getElementById('m-val').innerText = mVal.toFixed(1) + '%';

                //Controlla il valore letto e decide quale consiglio dare (cambiando testo e colore al riquadro #m-advice):
                //sotto il 30%, diventa rosso : "TERRENO SECCO: ACCENDI LA POMPA!".
                //sopra l'80%, diventa verde: "UMIDITÀ STABILE: SPEGNI LA POMPA!".
                //se è nel mezzo, diventa grigio e dice che è tutto in monitoraggio
                const ma = document.getElementById('m-advice');
                if (mVal < 30) {
                    ma.innerText = '⚠️ TERRENO SECCO: ACCENDI LA POMPA!';
                    ma.style.color = '#e74c3c';
                } else if (mVal > 80) {
                    ma.innerText = '✅ UMIDITÀ STABILE: SPEGNI LA POMPA!';
                    ma.style.color = '#27ae60';
                } else {
                    ma.innerText = 'Umidità in monitoraggio...';
                    ma.style.color = '#666';
                }

                //lo stesso processo viene fatto per il sensore di luce, che ha una proprietà chiamata illumination che rappresenta la quantità di luce in lux.
                const lRes = await lightSensor.readProperty('illumination');
                const lVal = await lRes.value();
                document.getElementById('l-val').innerText = Math.round(lVal) + ' lx';

                const la = document.getElementById('l-advice');
                if (lVal < 100) {
                    la.innerText = '☁️ POCA LUCE: ACCENDI LA LAMPADA!';
                    la.style.color = '#e67e22';
                } else if (lVal > 400) {
                    la.innerText = '☀️ LUCE SUFFICIENTE: SPEGNI LA LAMPADA';
                    la.style.color = '#2980b9';
                } else {
                    la.innerText = 'Luce adeguata';
                    la.style.color = '#666';
                }

                // --- SINCRONIZZAZIONE ATTUATORI  ---
                // Questo blocco permette all'interfaccia web di accorgersi se l'orchestratore
                // ha acceso o spento gli attuatori in background (in automatico).

                // Aspettiamo almeno 2 secondi dall'ultimo comando manuale.
                // Questo evita che l'interfaccia legga uno stato "vecchio" dal server appena dopo
                // che l'utente ha cliccato, causando uno sfarfallio dell'interruttore.
                if (irrigationSystem && (Date.now() - lastPumpActionTime > 2000)) {
                    // Legge la proprietà 'status' che abbiamo aggiunto in actuators.js per sapere se la pompa è accesa o spenta
                    const pRes = await irrigationSystem.readProperty('status');
                    const realPumpStatus = await pRes.value();
                    
                    // Se lo stato reale (sul server) è diverso da quello che l'interfaccia sta attualmente mostrando
                    if (realPumpStatus !== isPumpOn) {
                        isPumpOn = realPumpStatus; // Aggiorna lo stato della variabile locale
                        // Cambia l'immagine dell'interruttore per riflettere lo stato reale
                        document.getElementById('pump-toggle-img').src = isPumpOn ? '/img/water-on.png' : '/img/off.png';
                        // Aggiunge un messaggio al log per informare l'utente dell'intervento automatico
                        updateLog(` [Automazione] Pompa impostata su: ${isPumpOn ? 'ON' : 'OFF'}`);
                    }
                }

                if (smartLamp && (Date.now() - lastLampActionTime > 2000)) {
                    // Esegue per la lampada la stessa  logica di sincronizzazione vista per la pompa
                    const lRes = await smartLamp.readProperty('status');
                    const realLampStatus = await lRes.value();
                    if (realLampStatus !== isLampOn) {
                        isLampOn = realLampStatus;
                        document.getElementById('lamp-toggle-img').src = isLampOn ? '/img/light-on.png' : '/img/off.png';
                        updateLog(` [Automazione] Lampada impostata su: ${isLampOn ? 'ON' : 'OFF'}`);
                    }
                }
            } catch (e) {
                updateLog('⚠️ Errore durante il monitoraggio.');
            }
        }, 3000);
    } catch (err) {
        updateLog('❌ Errore inizializzazione: ' + err.message);
    }
}

async function togglePump() {
    // Registra il momento esatto in cui l'utente clicca il pulsante manuale.
    // Questo dirà alla funzione di sincronizzazione di non aggiornare la UI per i prossimi 2 secondi.
    lastPumpActionTime = Date.now();
    //isPumpOn è una variabile booleana che tiene traccia dello stato attuale della pompa (accesa o spenta).
    //Quando l'utente clicca sul pulsante per accendere o spegnere la pompa, questa funzione viene chiamata.
    isPumpOn = !isPumpOn;
    const img = document.getElementById('pump-toggle-img');
    
    //Per fornire un feedback visivo immediato, l'immagine del pulsante viene temporaneamente scalata
    img.style.transform = 'scale(0.8)';
    img.style.opacity = '0.5';
    
    //Dopo un breve ritardo di 150 millisecondi, l'immagine viene aggiornata per riflettere il nuovo stato della pompa 
    //(accensione o spegnimento) e viene ripristinata alla dimensione e opacità originali.
    setTimeout(async () => {
        img.src = isPumpOn ? '/img/water-on.png' : '/img/off.png';
        img.style.transform = 'scale(1)';
        img.style.opacity = '1';
        
        if (!irrigationSystem || !soilSensor) return;   //controlla che i dispositivi siano stati inizializzati correttamente prima di tentare di inviare comandi
        try {
            await irrigationSystem.invokeAction('toggle', isPumpOn);    //invia il comando alla pompa per accenderla o spegnerla, a seconda del nuovo stato di isPumpOn
            await soilSensor.invokeAction('updatePumpStatus', isPumpOn);//aggiorna lo stato della pompa anche sul sensore di umidità(sensor.js), in modo che possa fornire consigli più accurati basati sul fatto che la pompa è accesa o spenta
            updateLog(` [Manuale] Pompa impostata su: ${isPumpOn ? 'ON' : 'OFF'}`);//registra gli eventi di accensione e spegnimento della pompa nel log, indicando lo stato attuale
        } catch (e) {
            updateLog('❌ Errore sincronizzazione pompa');
        }
    }, 150);
}

async function toggleLamp() {
    lastLampActionTime = Date.now();
    isLampOn = !isLampOn;
    const img = document.getElementById('lamp-toggle-img');
    
    img.style.transform = 'scale(0.8)';
    img.style.opacity = '0.5';
    
    setTimeout(async () => {
        img.src = isLampOn ? '/img/light-on.png' : '/img/off.png';
        img.style.transform = 'scale(1)';
        img.style.opacity = '1';
        
        if (!smartLamp || !lightSensor) return;
        try {
            await smartLamp.invokeAction('switch', isLampOn);
            await lightSensor.invokeAction('updateLampStatus', isLampOn);
            updateLog(` [Manuale] Lampada impostata su: ${isLampOn ? 'ON' : 'OFF'}`);
        } catch (e) {
            updateLog('❌ Errore comando lampada');
        }
    }, 150);
}

window.onload = init;
