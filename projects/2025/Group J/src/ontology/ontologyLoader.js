/**
 * Ontology Loader
 *
 * Carica ontology/ontology.jsonld da disco e la usa in due punti del
 * sistema:
 *
 *  1. Ogni Thing (doorSensor, windowSensor, ...) chiede a questo modulo
 *     l'IRI della propria classe (es. "proj:DoorSensor") e la usa come
 *     "@type" della propria Thing Description. Se la classe non esiste
 *     nell'ontologia, la Thing non si avvia: è una dipendenza funzionale,
 *     non decorativa.
 *  2. La Thing Directory usa l'ontologia per rispondere a query semantiche
 *     come GET /things?type=Sensor, risalendo la gerarchia subClassOf
 *     definita nell'ontologia (es. DoorSensor -> Sensor -> Thing).
 */

const fs = require('fs');
const path = require('path');

const ONTOLOGY_PATH = path.join(__dirname, '..', '..', 'ontology', 'ontology.jsonld');

let cached = null;

function loadOntology() {
  if (cached) return cached;
  const raw = fs.readFileSync(ONTOLOGY_PATH, 'utf-8');
  cached = JSON.parse(raw);
  return cached;
}

/**
 * Ritorna il prefisso JSON-LD dell'ontologia di progetto (proj: -> IRI),
 * da aggiungere al @context della TD in modo che "@type": "proj:DoorSensor"
 * sia risolvibile a un IRI assoluto.
 */
function getOntologyContext() {
  const ontology = loadOntology();
  return { proj: ontology['@context'].proj };
}

/**
 * Risolve il termine JSON-LD (es. "DoorSensor") nell'IRI compatto della
 * classe definita in ontology.jsonld (es. "proj:DoorSensor"). Lancia un
 * errore se la classe non esiste: una Thing non può dichiararsi di un
 * tipo che l'ontologia non conosce.
 */
function getClass(label) {
  const ontology = loadOntology();
  const entry = ontology['@graph'].find(
    (node) => node.label === label && node['@type'] === 'owl:Class'
  );
  if (!entry) {
    throw new Error(
      `[Ontology] Classe "${label}" non trovata in ontology.jsonld: impossibile annotare semanticamente la Thing`
    );
  }
  return entry['@id'];
}

/**
 * Vero se `childId` è la stessa classe di `ancestorId` oppure ne è
 * sottoclasse (diretta o transitiva), risalendo i legami subClassOf
 * dichiarati in ontology.jsonld.
 */
function isSubClassOf(childId, ancestorId, ontology = loadOntology()) {
  if (childId === ancestorId) return true;
  const node = ontology['@graph'].find((n) => n['@id'] === childId);
  if (!node || !node.subClassOf) return false;
  const parents = Array.isArray(node.subClassOf) ? node.subClassOf : [node.subClassOf];
  return parents.some((parentId) => isSubClassOf(parentId, ancestorId, ontology));
}

module.exports = { loadOntology, getOntologyContext, getClass, isSubClassOf };
