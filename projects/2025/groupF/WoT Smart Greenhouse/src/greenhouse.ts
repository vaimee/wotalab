/**
 * Modello dei due profili di serra e logica di irrigazione.
 *
 * Questo modulo non fa I/O e non dipende da node-wot: contiene solo dati e
 * funzioni pure. Il sensore lo usa per generare letture plausibili,
 * l'orchestratore per decidere quanto irrigare. Tenendo la regola qui, la
 * logica di controllo resta in un unico punto e verificabile a colpo d'occhio.
 */

/** I due tipi di serra simulati, ossia i valori ammessi dalla property activeGreenhouse. */
export const GREENHOUSE_TYPES = ["tropical", "mediterranean"] as const;
export type GreenhouseType = (typeof GREENHOUSE_TYPES)[number];

/** Scaglione di irrigazione: sotto minHumidity si irriga per durationSeconds. */
interface IrrigationStep {
  /** Umidità minima (inclusa) a cui si applica questo scaglione. */
  minHumidity: number;
  /** Durata dell'irrigazione, in secondi. */
  durationSeconds: number;
  /** Etichetta usata nei log, per rendere leggibile la decisione. */
  level: string;
}

/** Intervallo chiuso di valori generati dal simulatore. */
interface Range {
  min: number;
  max: number;
}

interface GreenhouseProfile {
  /** Soglia di umidità del suolo sotto la quale scatta l'irrigazione, in %. */
  humidityThreshold: number;
  /**
   * Scaglioni ordinati dal più umido al più secco. Si applica il primo la cui
   * minHumidity è <= all'umidità misurata; l'ultimo funge da caso critico.
   */
  irrigationSteps: IrrigationStep[];
  /** Intervalli entro cui il simulatore genera le letture. */
  simulation: { temperature: Range; humidity: Range };
}

/**
 * Profili delle due serre.
 *
 * La serra tropicale vuole più acqua (soglia 40%) e sta su temperature più
 * alte; la mediterranea tollera un suolo più secco (soglia 30%).
 */
export const GREENHOUSE_PROFILES: Record<GreenhouseType, GreenhouseProfile> = {
  tropical: {
    humidityThreshold: 40,
    irrigationSteps: [
      { minHumidity: 35, durationSeconds: 5, level: "basso" },
      { minHumidity: 30, durationSeconds: 10, level: "medio" },
      { minHumidity: 25, durationSeconds: 20, level: "alto" },
      { minHumidity: 0, durationSeconds: 30, level: "critico" },
    ],
    simulation: {
      temperature: { min: 24, max: 32 },
      humidity: { min: 25, max: 50 },
    },
  },
  mediterranean: {
    humidityThreshold: 30,
    irrigationSteps: [
      { minHumidity: 25, durationSeconds: 5, level: "basso" },
      { minHumidity: 20, durationSeconds: 10, level: "medio" },
      { minHumidity: 15, durationSeconds: 15, level: "alto" },
      { minHumidity: 0, durationSeconds: 25, level: "critico" },
    ],
    simulation: {
      temperature: { min: 18, max: 26 },
      humidity: { min: 30, max: 60 },
    },
  },
};

/** Type guard: verifica che una stringa arbitraria sia un tipo di serra valido. */
export function isGreenhouseType(value: unknown): value is GreenhouseType {
  return GREENHOUSE_TYPES.includes(value as GreenhouseType);
}

/**
 * Decide se e quanto irrigare, data l'umidità del suolo e il tipo di serra.
 *
 * Restituisce null quando l'umidità è pari o superiore alla soglia, cioè
 * quando non serve irrigare. Altrimenti restituisce la durata proporzionale
 * al deficit rilevato: più il suolo è secco, più lungo è il ciclo.
 */
export function planIrrigation(
  greenhouse: GreenhouseType,
  humidity: number
): { durationSeconds: number; level: string } | null {
  const profile = GREENHOUSE_PROFILES[greenhouse];

  if (humidity >= profile.humidityThreshold) {
    return null;
  }

  // Il primo scaglione che copre questa umidità; l'ultimo ha minHumidity 0,
  // quindi la ricerca trova sempre una corrispondenza.
  const step =
    profile.irrigationSteps.find((s) => humidity >= s.minHumidity) ??
    profile.irrigationSteps[profile.irrigationSteps.length - 1];

  return { durationSeconds: step.durationSeconds, level: step.level };
}

/** Genera un valore casuale nell'intervallo indicato, arrotondato a 2 decimali. */
function randomInRange({ min, max }: Range): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

/** Produce una lettura simulata coerente con il profilo della serra attiva. */
export function simulateReading(greenhouse: GreenhouseType): {
  temperature: number;
  humidity: number;
} {
  const { simulation } = GREENHOUSE_PROFILES[greenhouse];
  return {
    temperature: randomInRange(simulation.temperature),
    humidity: randomInRange(simulation.humidity),
  };
}
