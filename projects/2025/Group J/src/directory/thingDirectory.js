/**
 * Thing Directory (WoT Discovery)
 *
 * Fornisce un meccanismo di discovery per le Thing del sistema: ogni Thing,
 * dopo essersi esposta come Producer node-wot, si autoregistra qui
 * inviando la propria TD (POST /things). Chiunque voglia scoprire le Thing
 * del sistema (Orchestrator, dashboard, un tool esterno) lo fa parlando
 * solo con questo servizio, senza avere conoscenza a priori delle porte
 * delle singole Thing.
 *
 * Espone anche il well-known URL della TD Discovery (introduction
 * mechanism previsto da W3C WoT Discovery) e supporta query semantiche
 * (GET /things?type=Sensor) risolte tramite ontology.jsonld.
 */

const express = require('express');
const cors = require('cors');
const { loadOntology, getOntologyContext, isSubClassOf } = require('../ontology/ontologyLoader');

const PROJ_PREFIX = 'proj:';

class ThingDirectory {
  constructor(options = {}) {
    this.port = options.port || 3009;
    this.things = new Map(); // td.id -> TD

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json({ limit: '1mb' }));
    this._setupRoutes();

    this.ready = this._start();
  }

  _setupRoutes() {
    // Introduction mechanism: chiunque conosca solo host:porta della
    // Directory può scoprirne le capacità partendo da questo URL standard.
    this.app.get('/.well-known/wot-thing-description', (req, res) => {
      res.json(this._getDirectoryTD());
    });

    // Le Thing si autoregistrano qui con la propria TD reale, generata da
    // node-wot al momento della expose().
    this.app.post('/things', (req, res) => {
      const td = req.body;
      if (!td || !td.id) {
        return res.status(400).json({ error: 'TD non valida: campo "id" mancante' });
      }
      this.things.set(td.id, td);
      console.log(`[ThingDirectory] Registrata "${td.title}" (${td.id})`);
      res.status(201).json({ registered: td.id });
    });

    // Discovery: elenco di tutte le TD registrate. Supporta il filtro
    // semantico ?type=<Classe> risolto tramite ontology.jsonld (include le
    // sottoclassi: ?type=Sensor ritorna anche DoorSensor/WindowSensor/...).
    this.app.get('/things', (req, res) => {
      let list = Array.from(this.things.values());
      if (req.query.type) {
        list = list.filter((td) => this._matchesType(td, req.query.type));
      }
      res.json(list);
    });

    this.app.get('/things/:id', (req, res) => {
      const td = Array.from(this.things.values()).find(
        (t) => t.id === req.params.id || t.id.endsWith(':' + req.params.id)
      );
      if (!td) return res.status(404).json({ error: 'Thing non trovata' });
      res.json(td);
    });

    this.app.delete('/things/:id', (req, res) => {
      const entry = Array.from(this.things.entries()).find(
        ([id]) => id === req.params.id || id.endsWith(':' + req.params.id)
      );
      if (!entry) return res.status(404).json({ error: 'Thing non trovata' });
      this.things.delete(entry[0]);
      res.status(204).end();
    });
  }

  _matchesType(td, queriedLabel) {
    const ontology = loadOntology();
    const queriedId = queriedLabel.startsWith(PROJ_PREFIX) ? queriedLabel : PROJ_PREFIX + queriedLabel;
    const tdTypes = Array.isArray(td['@type']) ? td['@type'] : [td['@type']].filter(Boolean);
    return tdTypes.some((typeId) => isSubClassOf(typeId, queriedId, ontology));
  }

  _getDirectoryTD() {
    return {
      '@context': ['https://www.w3.org/2022/wot/td/v1.1', getOntologyContext()],
      '@type': 'ThingDirectory',
      id: 'urn:wot:thing-directory:smart-home-security',
      title: 'Smart Home Security - Thing Directory',
      description:
        'Directory WoT che raccoglie le Thing Description autogenerate da node-wot per le Thing del sistema di sicurezza domestica, e ne permette la discovery.',
      base: `http://localhost:${this.port}`,
      properties: {
        things: {
          title: 'Things registrate',
          description: 'Elenco delle TD registrate. Supporta ?type=<ClasseOntologia> per query semantiche.',
          type: 'array',
          readOnly: true,
          forms: [{ href: '/things', 'htv:methodName': 'GET', contentType: 'application/json' }]
        }
      }
    };
  }

  async _start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(
          `[ThingDirectory] In ascolto su http://localhost:${this.port} (well-known: /.well-known/wot-thing-description)`
        );
        resolve();
      });
    });
  }
}

module.exports = ThingDirectory;
