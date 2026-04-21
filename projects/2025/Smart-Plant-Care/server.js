const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve i file statici (HTML, CSS, JS) dalla cartella corrente e dalla cartella src
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'src')));

// Rotta principale che restituisce il file index.html dalla cartella src
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Rotta per la pagina di monitoraggio di una singola pianta
app.get('/plant', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'plant.html'));
});

app.listen(port, () => {
    console.log(`🌍 Dashboard disponibile su http://localhost:${port}`);
});