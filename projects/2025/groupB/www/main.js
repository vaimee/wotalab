// ============================================================================
// SISTEMA DI IRRIGAZIONE INTELLIGENTE - DASHBOARD WEB
// Con WebSocket Real-time, Configurazione Dinamica e Grafici Interattivi
// ============================================================================

// Configurazione WebSocket
const WS_URL = 'ws://localhost:3000';
let ws = null;
let reconnectInterval = null;

// Stato dell'applicazione
let appState = {
    connected: false,
    wsConnected: false,
    irrigationsCount: 0,
    startTime: Date.now(),
    canvas: null,
    ctx: null,
    chart: null,
    dataHistory: [],
    config: {
        minSoilMoisture: 35,
        maxSoilMoisture: 70,
        minLightForIrrigation: 3000,
        isAutoMode: true
    }
};

// ============================================================================
// INIZIALIZZAZIONE
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Dashboard inizializzata');
    initCanvas();
    initChart();
    initEventListeners();
    connectWebSocket();
    // Nota: l'orologio ora mostra l'ora simulata ricevuta dal sensore, non più l'ora reale
    updateUptime();
});

// ============================================================================
// WEBSOCKET
// ============================================================================

function connectWebSocket() {
    console.log('🔌 Connessione WebSocket a', WS_URL);
    
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('✅ WebSocket connesso - Aggiornamenti real-time attivi!');
            appState.wsConnected = true;
            updateConnectionStatus(true);
            addLogEntry('✅ Connessione WebSocket stabilita - Dati in tempo reale', 'success');
            addLogEntry('🔗 Connesso al sistema', 'success');
            
            // Richiedi stato iniziale
            ws.send(JSON.stringify({ type: 'getStatus' }));
            
            // Cancella tentativi di riconnessione
            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (error) {
                console.error('Errore parsing messaggio:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('❌ Errore WebSocket:', error);
            appState.wsConnected = false;
            updateConnectionStatus(false);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket disconnesso');
            appState.wsConnected = false;
            updateConnectionStatus(false);
            addLogEntry('⚠️ Disconnesso dal sistema', 'warning');
            
            // Tentativo di riconnessione automatica
            if (!reconnectInterval) {
                reconnectInterval = setInterval(() => {
                    console.log('🔄 Tentativo riconnessione...');
                    connectWebSocket();
                }, 5000);
            }
        };
    } catch (error) {
        console.error('Errore creazione WebSocket:', error);
        updateConnectionStatus(false);
    }
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'status':
            updateFullStatus(message.data);
            break;
        
        case 'sensorUpdate':
            updateSensorData(message.data);
            break;
        
        case 'configUpdate':
            updateConfigDisplay(message.data);
            break;
        
        case 'irrigationStart':
            handleIrrigationStart(message.data);
            break;
        
        case 'irrigationStop':
            handleIrrigationStop(message.data);
            break;
        
        case 'history':
            updateHistoryData(message.data);
            break;
    }
}

// ============================================================================
// GESTIONE DATI
// ============================================================================

function updateFullStatus(status) {
    // Aggiorna sensori
    if (status.sensors) {
        updateSensorData({
            soilMoisture: status.sensors.soilMoisture,
            temperature: status.sensors.temperature,
            luminosity: status.sensors.luminosity,
            isPumping: status.pump?.isPumping || false
        });
    }
    
    // Aggiorna pompa
    if (status.pump) {
        updatePumpDisplay(status.pump);
    }
    
    // Aggiorna configurazione
    if (status.config) {
        appState.config = status.config;
        updateConfigDisplay(status.config);
    }
}

function updateSensorData(data) {
    // Umidità terreno
    if (data.soilMoisture !== undefined) {
        document.getElementById('soil-moisture').textContent = data.soilMoisture.toFixed(1);
        document.getElementById('moisture-progress').style.width = data.soilMoisture + '%';
        
        // Determina stato
        let state = '';
        let stateColor = '';
        if (data.soilMoisture < appState.config.minSoilMoisture) {
            state = '🏜️ Secco - Necessita irrigazione';
            stateColor = '#ef4444';
        } else if (data.soilMoisture < 50) {
            state = '🌾 Umidità bassa';
            stateColor = '#f59e0b';
        } else if (data.soilMoisture < appState.config.maxSoilMoisture) {
            state = '✅ Umidità ottimale';
            stateColor = '#22c55e';
        } else {
            state = '💧 Molto umido';
            stateColor = '#3b82f6';
        }
        
        const humidityState = document.getElementById('humidity-state');
        humidityState.textContent = state;
        humidityState.style.color = stateColor;
    }
    
    // Temperatura
    if (data.temperature !== undefined) {
        document.getElementById('temperature').textContent = data.temperature.toFixed(1);
    }
    
    // Luminosità
    if (data.luminosity !== undefined) {
        document.getElementById('luminosity').textContent = Math.round(data.luminosity);
        
        const lightProgress = Math.min((data.luminosity / 100000) * 100, 100);
        document.getElementById('light-progress').style.width = lightProgress + '%';
        
        // Determina condizione
        let condition = '';
        if (data.luminosity < 1000) condition = '🌙 Buio';
        else if (data.luminosity < 5000) condition = '🌥️ Ombra';
        else if (data.luminosity < 20000) condition = '⛅ Nuvoloso';
        else if (data.luminosity < 50000) condition = '☀️ Sole';
        else condition = '🌞 Molto Luminoso';
        
        document.getElementById('light-condition').textContent = condition;
    }
    
    // ORA SIMULATA - Aggiorna l'orologio con l'ora della simulazione
    if (data.simulatedTime !== undefined) {
        document.getElementById('current-time').textContent = data.simulatedTime;
    }
    
    // Aggiungi ai dati storici se completo
    if (data.soilMoisture !== undefined && data.luminosity !== undefined) {
        addDataToHistory(data);
    }
    
    // Aggiorna visualizzazione
    drawSystem();
}

function updatePumpDisplay(pumpData) {
    const isPumping = pumpData.isPumping || false;
    const flowRate = pumpData.flowRate || 0;
    const totalWater = pumpData.totalWaterUsed || 0;
    
    document.getElementById('flow-rate').textContent = flowRate.toFixed(1);
    document.getElementById('total-water').textContent = totalWater.toFixed(2);
    
    const pumpIcon = document.getElementById('pump-icon');
    const pumpStatusText = document.getElementById('pump-status-text');
    const startBtn = document.getElementById('manual-start-btn');
    const stopBtn = document.getElementById('manual-stop-btn');
    
    if (isPumping) {
        // POMPA ATTIVA - Feedback visivo molto chiaro
        pumpIcon.classList.add('pumping');
        pumpIcon.textContent = '💦💦💦'; // Triple gocce per massima visibilità
        pumpIcon.style.fontSize = '3rem';
        pumpIcon.style.filter = 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.8))';
        
        pumpStatusText.textContent = '🚨 IRRIGAZIONE ATTIVA';
        pumpStatusText.classList.add('active');
        pumpStatusText.style.fontSize = '1.3rem';
        pumpStatusText.style.fontWeight = 'bold';
        pumpStatusText.style.color = '#22c55e';
        pumpStatusText.style.textShadow = '0 0 10px rgba(34, 197, 94, 0.5)';
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        console.log('🚨💦 POMPA ATTIVA - Visualizzazione aggiornata');
    } else {
        // POMPA SPENTA - Stato normale
        pumpIcon.classList.remove('pumping');
        pumpIcon.textContent = '🚰';
        pumpIcon.style.fontSize = '2.5rem';
        pumpIcon.style.filter = 'none';
        
        pumpStatusText.textContent = '⏸️ In Attesa';
        pumpStatusText.classList.remove('active');
        pumpStatusText.style.fontSize = '1rem';
        pumpStatusText.style.fontWeight = 'normal';
        pumpStatusText.style.color = '#6b7280';
        pumpStatusText.style.textShadow = 'none';
        
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
    
    // IMPORTANTE: Aggiorna la visualizzazione canvas
    drawSystem();
}

function updateConfigDisplay(config) {
    appState.config = config;
    
    document.getElementById('min-moisture-input').value = config.minSoilMoisture;
    document.getElementById('max-moisture-input').value = config.maxSoilMoisture;
    document.getElementById('min-light-input').value = config.minLightForIrrigation;
    document.getElementById('auto-mode-toggle').checked = config.isAutoMode;
    
    const autoModeText = document.getElementById('auto-mode-text');
    autoModeText.textContent = `Modalità Automatica: ${config.isAutoMode ? 'ATTIVA' : 'DISATTIVA'}`;
    autoModeText.style.color = config.isAutoMode ? '#22c55e' : '#ef4444';
}

function handleIrrigationStart(data) {
    const reason = data.reason === 'manual' ? 'manuale' : 'automatica';
    addLogEntry(`💦 Irrigazione ${reason} avviata (${data.duration}s, ${data.flowRate}L/min)`, 'success');
    appState.irrigationsCount++;
    updateStatistics();
    
    // RICHIEDI STATO COMPLETO per aggiornare immediatamente la visualizzazione pompa
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getStatus' }));
    }
}

function handleIrrigationStop(data) {
    const reason = data.reason === 'manual' ? 'manuale' : 'automatica';
    addLogEntry(`🛑 Irrigazione ${reason} interrotta`, 'warning');
    
    // RICHIEDI STATO COMPLETO per aggiornare immediatamente la visualizzazione pompa
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'getStatus' }));
    }
}

// ============================================================================
// GRAFICO STORICO
// ============================================================================

function initChart() {
    const ctx = document.getElementById('history-chart').getContext('2d');
    
    appState.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Umidità Terreno (%)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    hidden: false
                },
                {
                    label: 'Temperatura (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4,
                    hidden: false
                },
                {
                    label: 'Luminosità (lux / 100)',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    yAxisID: 'y2',
                    tension: 0.4,
                    hidden: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Tempo'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Umidità (%)',
                        color: '#3b82f6'
                    },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Temperatura (°C)',
                        color: '#ef4444'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    min: 0,
                    max: 50
                },
                y2: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    min: 0,
                    max: 1000
                }
            }
        }
    });
}

function addDataToHistory(data) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    
    // Aggiungi ai dati storici
    appState.dataHistory.push({
        time: timeLabel,
        soilMoisture: data.soilMoisture,
        temperature: data.temperature,
        luminosity: data.luminosity / 100 // Scala per il grafico
    });
    
    // Mantieni solo gli ultimi 50 punti
    if (appState.dataHistory.length > 50) {
        appState.dataHistory.shift();
    }
    
    updateChart();
}

function updateHistoryData(history) {
    // Carica storico dal server
    appState.dataHistory = history.map(item => {
        const date = new Date(item.timestamp);
        return {
            time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            soilMoisture: item.soilMoisture,
            temperature: item.temperature,
            luminosity: item.luminosity / 100
        };
    });
    
    updateChart();
}

function updateChart() {
    if (!appState.chart) return;
    
    const labels = appState.dataHistory.map(d => d.time);
    const moistureData = appState.dataHistory.map(d => d.soilMoisture);
    const tempData = appState.dataHistory.map(d => d.temperature);
    const lightData = appState.dataHistory.map(d => d.luminosity);
    
    appState.chart.data.labels = labels;
    appState.chart.data.datasets[0].data = moistureData;
    appState.chart.data.datasets[1].data = tempData;
    appState.chart.data.datasets[2].data = lightData;
    
    appState.chart.update('none'); // 'none' per aggiornamento senza animazione
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function initEventListeners() {
    // Controlli pompa
    document.getElementById('manual-start-btn').addEventListener('click', () => {
        const duration = parseInt(document.getElementById('duration-input').value);
        const flowRate = parseFloat(document.getElementById('flow-rate-input').value);
        manualStartPump(duration, flowRate);
    });

    document.getElementById('manual-stop-btn').addEventListener('click', () => {
        manualStopPump();
    });

    // Configurazione
    document.getElementById('save-config-btn').addEventListener('click', () => {
        saveConfiguration();
    });

    document.getElementById('auto-mode-toggle').addEventListener('change', (e) => {
        toggleAutoMode(e.target.checked);
    });

    // Toggle visualizzazione grafico
    document.getElementById('show-moisture').addEventListener('change', (e) => {
        appState.chart.data.datasets[0].hidden = !e.target.checked;
        appState.chart.update();
    });

    document.getElementById('show-temperature').addEventListener('change', (e) => {
        appState.chart.data.datasets[1].hidden = !e.target.checked;
        appState.chart.update();
    });

    document.getElementById('show-luminosity').addEventListener('change', (e) => {
        appState.chart.data.datasets[2].hidden = !e.target.checked;
        appState.chart.update();
    });

    // Pulisci log
    document.getElementById('clear-log-btn').addEventListener('click', () => {
        document.getElementById('event-log').innerHTML = '<div class="log-entry">Log pulito</div>';
    });
}

// ============================================================================
// COMANDI WEBSOCKET
// ============================================================================

function manualStartPump(duration, flowRate) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addLogEntry('❌ WebSocket non connesso', 'error');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'manualStart',
        duration: duration,
        flowRate: flowRate
    }));
    
    addLogEntry(`🎮 Comando avvio pompa inviato (${duration}s, ${flowRate}L/min)`, 'info');
}

function manualStopPump() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addLogEntry('❌ WebSocket non connesso', 'error');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'manualStop'
    }));
    
    addLogEntry('🛑 Comando stop pompa inviato', 'info');
}

function saveConfiguration() {
    const minMoisture = parseInt(document.getElementById('min-moisture-input').value);
    const maxMoisture = parseInt(document.getElementById('max-moisture-input').value);
    const minLight = parseInt(document.getElementById('min-light-input').value);
    
    // Validazione
    if (minMoisture >= maxMoisture) {
        addLogEntry('❌ Umidità minima deve essere < umidità massima', 'error');
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addLogEntry('❌ WebSocket non connesso', 'error');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'updateConfig',
        config: {
            minSoilMoisture: minMoisture,
            maxSoilMoisture: maxMoisture,
            minLightForIrrigation: minLight
        }
    }));
    
    addLogEntry('⚙️ Configurazione aggiornata', 'success');
}

function toggleAutoMode(enabled) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addLogEntry('❌ WebSocket non connesso', 'error');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'updateConfig',
        config: {
            isAutoMode: enabled
        }
    }));
    
    const autoModeText = document.getElementById('auto-mode-text');
    autoModeText.textContent = `Modalità Automatica: ${enabled ? 'ATTIVA' : 'DISATTIVA'}`;
    autoModeText.style.color = enabled ? '#22c55e' : '#ef4444';
    
    addLogEntry(`⚙️ Modalità automatica ${enabled ? 'attivata' : 'disattivata'}`, 'info');
}

// ============================================================================
// VISUALIZZAZIONE 2D
// ============================================================================

function initCanvas() {
    appState.canvas = document.getElementById('system-canvas');
    appState.ctx = appState.canvas.getContext('2d');
    drawSystem();
}

function drawSystem() {
    const ctx = appState.ctx;
    const canvas = appState.canvas;
    
    // Pulisci canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sfondo
    ctx.fillStyle = '#e8f5e9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Terreno
    const soilMoisture = parseFloat(document.getElementById('soil-moisture').textContent) || 50;
    const soilColor = getSoilColor(soilMoisture);
    
    ctx.fillStyle = soilColor;
    ctx.fillRect(50, 200, 700, 80);

    // Pianta
    drawPlant(ctx, 200, 200, soilMoisture);
    drawPlant(ctx, 400, 200, soilMoisture);
    drawPlant(ctx, 600, 200, soilMoisture);

    // Sole
    const luminosity = parseFloat(document.getElementById('luminosity').textContent) || 5000;
    drawSun(ctx, 700, 60, luminosity);

    // Nuvole
    if (luminosity < 20000) {
        drawCloud(ctx, 150, 50);
        drawCloud(ctx, 500, 70);
    }

    // Pompa
    const isPumping = document.getElementById('pump-icon').classList.contains('pumping');
    drawPump(ctx, 50, 100, isPumping);

    // Gocce d'acqua se sta irrigando
    if (isPumping) {
        drawWaterDrops(ctx);
    }

    // Info testo CON SFONDO per leggibilità
    // Box sfondo bianco semi-trasparente
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(50, 220, 180, 55);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 220, 180, 55);
    
    // Testo nero ben leggibile
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`Umidità: ${soilMoisture.toFixed(1)}%`, 60, 245);
    ctx.fillText(`Luce: ${Math.round(luminosity)} lux`, 60, 265);
}

function getSoilColor(moisture) {
    if (moisture < 35) return '#8B4513';
    if (moisture < 50) return '#A0522D';
    if (moisture < 70) return '#654321';
    return '#4A3728';
}

function drawPlant(ctx, x, y, moisture) {
    const health = moisture / 100;
    
    ctx.strokeStyle = health > 0.3 ? '#2d5016' : '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 40);
    ctx.stroke();

    ctx.fillStyle = health > 0.5 ? '#4ade80' : health > 0.3 ? '#a3e635' : '#fde047';
    ctx.beginPath();
    ctx.arc(x - 10, y - 30, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 10, y - 30, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 40, 10, 0, Math.PI * 2);
    ctx.fill();
}

function drawSun(ctx, x, y, luminosity) {
    const intensity = Math.min(luminosity / 50000, 1);
    const radius = 25;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius + 20);
    gradient.addColorStop(0, `rgba(255, 235, 59, ${intensity * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 235, 59, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius - 20, y - radius - 20, (radius + 20) * 2, (radius + 20) * 2);

    ctx.fillStyle = `rgba(255, 235, 59, ${intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 235, 59, ${intensity})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * (radius + 5), y + Math.sin(angle) * (radius + 5));
        ctx.lineTo(x + Math.cos(angle) * (radius + 15), y + Math.sin(angle) * (radius + 15));
        ctx.stroke();
    }
}

function drawCloud(ctx, x, y) {
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 25, y, 25, 0, Math.PI * 2);
    ctx.arc(x + 50, y, 20, 0, Math.PI * 2);
    ctx.fill();
}

function drawPump(ctx, x, y, isActive) {
    ctx.fillStyle = isActive ? '#22c55e' : '#667eea';
    ctx.fillRect(x, y, 40, 60);
    
    ctx.strokeStyle = isActive ? '#22c55e' : '#667eea';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 40, y + 30);
    ctx.lineTo(x + 100, y + 30);
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('💧', x + 8, y + 40);
}

function drawWaterDrops(ctx) {
    const time = Date.now();
    for (let i = 0; i < 5; i++) {
        const x = 150 + (i * 100) + Math.sin(time / 200 + i) * 20;
        const y = 120 + ((time + i * 200) % 80);
        
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // CONTINUA L'ANIMAZIONE SOLO SE LA POMPA È ANCORA ATTIVA
    const isPumping = document.getElementById('pump-icon').classList.contains('pumping');
    if (isPumping) {
        requestAnimationFrame(() => drawSystem());
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function updateConnectionStatus(connected) {
    appState.connected = connected;
    const statusText = document.getElementById('connection-text');
    const statusItem = document.getElementById('connection-status');
    
    if (connected) {
        statusText.textContent = 'Connesso';
        statusItem.style.color = '#22c55e';
    } else {
        statusText.textContent = 'Disconnesso';
        statusItem.style.color = '#ef4444';
    }
    
    // Aggiorna indicatori sensori
    const statuses = ['humidity-status', 'light-status', 'pump-status'];
    statuses.forEach(id => {
        const elem = document.getElementById(id);
        elem.className = 'sensor-status ' + (connected ? 'online' : 'offline');
    });
}

// Nota: La funzione startClock() è stata rimossa perché ora l'orologio
// mostra l'ora simulata ricevuta dal sensore di luminosità via WebSocket

function updateUptime() {
    function update() {
        const uptime = Date.now() - appState.startTime;
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        document.getElementById('uptime').textContent = `${hours}h ${minutes}m`;
    }
    update();
    setInterval(update, 60000);
}

function updateStatistics() {
    document.getElementById('irrigations-count').textContent = appState.irrigationsCount;
    
    const totalWater = parseFloat(document.getElementById('total-water').textContent) || 0;
    const waterSaved = Math.max(0, (appState.irrigationsCount * 50) - totalWater);
    document.getElementById('water-saved').textContent = waterSaved.toFixed(1) + ' L';
    
    const efficiency = appState.irrigationsCount > 0 
        ? Math.min(100, ((waterSaved / (appState.irrigationsCount * 50)) * 100))
        : 100;
    document.getElementById('efficiency').textContent = efficiency.toFixed(0) + '%';
}

function addLogEntry(message, type = 'info') {
    const log = document.getElementById('event-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString('it-IT');
    entry.textContent = `[${timestamp}] ${message}`;
    
    log.insertBefore(entry, log.firstChild);
    
    while (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
}
