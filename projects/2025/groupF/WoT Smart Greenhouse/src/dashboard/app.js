/**
 * Configurazione e utilita' condivise da tutte le pagine della dashboard.
 *
 * Prima ogni pagina ridefiniva endpoint, soglie, colori e helper per conto
 * proprio, e i valori divergevano fra loro e dal backend (per esempio lo schema
 * della temperatura era dichiarato 20-35 in una pagina mentre la TD dice
 * 15-35). Tenendoli qui, la dashboard ha una sola fonte di verita'.
 */

/* ------------------------------------------------------------------ *
 * Endpoint WoT
 * ------------------------------------------------------------------ */

const SENSOR_URL = "http://localhost:8080/sensore-ambientale-serra";
const PUMP_URL = "http://localhost:8082/pompa-irrigazione-serra";

const WOT = {
  sensor: {
    td: SENSOR_URL,
    temperature: `${SENSOR_URL}/properties/temperature`,
    humidity: `${SENSOR_URL}/properties/humidity`,
    activeGreenhouse: `${SENSOR_URL}/properties/activeGreenhouse`,
  },
  pump: {
    td: PUMP_URL,
    status: `${PUMP_URL}/properties/pumpStatus`,
    turnOn: `${PUMP_URL}/actions/turnOnPump`,
  },
};

/**
 * NOTA DI SICUREZZA: il token vive nel codice della pagina solo per rendere
 * immediata la demo di laboratorio. Essendo lato client e' leggibile da
 * chiunque apra il sorgente, quindi su questo percorso la protezione
 * dell'attuatore e' di fatto aggirabile. In un sistema reale la pagina
 * otterrebbe un token a tempo da un authorization server (OAuth2).
 */
const PUMP_TOKEN = "chiave-segreta-pompa";

/** Ogni quanto la dashboard rilegge sensori e attuatore, in millisecondi. */
const POLL_MS = { sensor: 5000, pump: 3000 };

/* ------------------------------------------------------------------ *
 * Profili delle serre — rispecchiano src/greenhouse.ts
 * ------------------------------------------------------------------ */

const PROFILES = {
  tropical: {
    label: "Serra Tropicale",
    humidityThreshold: 40,
    temperature: { min: 24, max: 32 },
    humidity: { min: 25, max: 50 },
    steps: [
      { from: 35, seconds: 5, level: "basso" },
      { from: 30, seconds: 10, level: "medio" },
      { from: 25, seconds: 20, level: "alto" },
      { from: 0, seconds: 30, level: "critico" },
    ],
  },
  mediterranean: {
    label: "Serra Mediterranea",
    humidityThreshold: 30,
    temperature: { min: 18, max: 26 },
    humidity: { min: 15, max: 60 },
    steps: [
      { from: 25, seconds: 5, level: "basso" },
      { from: 20, seconds: 10, level: "medio" },
      { from: 15, seconds: 15, level: "alto" },
      { from: 0, seconds: 25, level: "critico" },
    ],
  },
};

/** Metadati delle due grandezze osservate, usati dalle card e dai grafici. */
const METRICS = {
  temperature: {
    key: "temperature",
    label: "Temperatura aria",
    unit: "°C",
    url: WOT.sensor.temperature,
    schema: { type: "number", minimum: 15, maximum: 35 },
    semantic: "sosa:ObservableProperty · qudt:unit unit:DEG_C",
    color: "var(--series-temp)",
  },
  humidity: {
    key: "humidity",
    label: "Umidità suolo",
    unit: "%",
    url: WOT.sensor.humidity,
    schema: { type: "number", minimum: 0, maximum: 100 },
    semantic: "sosa:ObservableProperty · qudt:unit unit:PERCENT",
    color: "var(--series-hum)",
  },
};

/**
 * Replica lato client di planIrrigation(): dice se e quanto si irrigherebbe.
 * Serve a spiegare in interfaccia perche' la pompa parte; la decisione vera
 * resta dell'orchestratore.
 */
function planIrrigation(profile, humidity) {
  if (humidity >= profile.humidityThreshold) return null;
  return profile.steps.find((s) => humidity >= s.from) ?? profile.steps[profile.steps.length - 1];
}

/* ------------------------------------------------------------------ *
 * Serra attiva (condivisa fra le pagine via sessionStorage)
 * ------------------------------------------------------------------ */

/**
 * Restituisce il tipo di serra scelto nella pagina di selezione.
 * `redirect: true` rimanda alla selezione se non ce n'e' uno valido.
 */
function activeGreenhouse({ redirect = false } = {}) {
  const fromUrl = new URLSearchParams(location.search).get("type");
  const type = fromUrl ?? sessionStorage.getItem("greenhouse");

  if (type in PROFILES) {
    sessionStorage.setItem("greenhouse", type);
    return type;
  }
  if (redirect) location.replace("/index.html");
  return "tropical";
}

/* ------------------------------------------------------------------ *
 * Helper HTTP
 * ------------------------------------------------------------------ */

/** GET su un endpoint WoT che restituisce JSON. Lancia se la risposta non e' ok. */
async function readValue(url, token) {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Scrive una property (PUT) o invoca un'azione (POST) con corpo JSON. */
async function sendValue(url, value, { method = "POST", token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { method, headers, body: JSON.stringify(value) });
}

/* ------------------------------------------------------------------ *
 * Formattazione
 * ------------------------------------------------------------------ */

const clockTime = (date = new Date()) =>
  date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Posizione percentuale di un valore dentro un intervallo, limitata a 0-100. */
const positionIn = (value, { min, max }) =>
  Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

/* ------------------------------------------------------------------ *
 * Registro eventi
 * ------------------------------------------------------------------ */

/** Aggiunge una riga al registro eventi, se la pagina ne ha uno. */
function log(message, kind = "info") {
  const container = document.getElementById("log");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "log-row";
  row.innerHTML = `<span class="log-time"></span><span class="log-msg ${kind}"></span>`;
  row.querySelector(".log-time").textContent = clockTime();
  row.querySelector(".log-msg").textContent = message;

  container.append(row);
  while (container.children.length > 40) container.firstChild.remove();
  container.scrollTop = container.scrollHeight;
}

/* ------------------------------------------------------------------ *
 * Grafici
 * ------------------------------------------------------------------ */

/** Legge un token di colore dal CSS, cosi' i grafici usano la stessa palette. */
const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Grafico a linea con una sola serie e un solo asse.
 *
 * Un solo asse e' deliberato: la versione precedente sovrapponeva temperatura e
 * umidita' con due scale y diverse, e l'allineamento fra le due era arbitrario,
 * cioe' suggeriva correlazioni che nei dati non ci sono. Due grandezze diverse
 * ora stanno in due grafici affiancati.
 *
 * `threshold` disegna la soglia di irrigazione come riferimento tratteggiato.
 */
function createLineChart(canvas, { label, color, unit, suggestedMin, suggestedMax, threshold }) {
  const grid = cssColor("--grid");
  const ink = cssColor("--text-muted");

  const datasets = [
    {
      label: label ?? unit,
      data: [],
      borderColor: color,
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointBackgroundColor: color,
      pointHoverBorderColor: cssColor("--surface-2"),
      pointHoverBorderWidth: 2,
      tension: 0.3,
      order: 1,
    },
  ];

  if (threshold !== undefined) {
    datasets.push({
      label: `Soglia irrigazione (${threshold}${unit})`,
      data: [],
      borderColor: cssColor("--status-warning"),
      borderWidth: 1.5,
      borderDash: [5, 4],
      pointRadius: 0,
      pointHitRadius: 0,
      fill: false,
      order: 2,
    });
  }

  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        // Con una sola serie il titolo della card la nomina gia': la legenda
        // compare solo quando c'e' anche la soglia da distinguere.
        legend: {
          display: threshold !== undefined,
          position: "bottom",
          labels: { color: ink, boxWidth: 10, boxHeight: 2, font: { size: 11 }, padding: 12 },
        },
        tooltip: {
          backgroundColor: cssColor("--surface-3"),
          borderColor: cssColor("--border"),
          borderWidth: 1,
          titleColor: cssColor("--text-muted"),
          bodyColor: cssColor("--text"),
          padding: 10,
          displayColors: false,
          callbacks: { label: (item) => `${item.formattedValue} ${unit}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: grid },
          ticks: { color: ink, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 24 },
        },
        y: {
          suggestedMin,
          suggestedMax,
          grid: { color: grid },
          border: { display: false },
          ticks: { color: ink, font: { size: 10 }, padding: 8 },
        },
      },
    },
  });
}

/** Aggiunge un punto al grafico, mantenendo una finestra scorrevole. */
function pushPoint(chart, label, value, { keep = 20, threshold } = {}) {
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  if (threshold !== undefined) chart.data.datasets[1].data.push(threshold);

  while (chart.data.labels.length > keep) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((set) => set.data.shift());
  }
  chart.update();
}
