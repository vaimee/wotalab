import { loadTdJson } from "./loadTd.js";

type WoTLike = { produce: (td: any) => Promise<any>; };

export type LightState = {
  illuminanceLux: number;
  status: "online" | "offline" | "error";
};

export async function createLightSensor(
  wot: WoTLike,
  getLightActuatorState: () => boolean,
  getWindowState: () => boolean
) {
  const td = loadTdJson("light-sensor.tm.json");
  const thing = await wot.produce(td);

  const state: LightState = { illuminanceLux: 150, status: "online" };

  thing.setPropertyReadHandler("illuminanceLux", async () => state.illuminanceLux);
  thing.setPropertyWriteHandler("illuminanceLux", async (v: any) => await setIlluminanceLux(await v.value()));
  thing.setPropertyReadHandler("status", async () => state.status);
  thing.setActionHandler("reset", async () => { await setStatus("online"); return true; });

  const setIlluminanceLux = async (v: number) => {
    const next = Math.max(0, Math.min(100000, Number(v)));
    const changed = Math.abs(next - state.illuminanceLux) >= 10;
    state.illuminanceLux = next;
    try { await thing.writeProperty("illuminanceLux", state.illuminanceLux); } catch { }
    if (changed) thing.emitEvent("illuminanceChanged", state.illuminanceLux);
  };

  const setStatus = async (v: LightState["status"]) => {
    state.status = v;
    try { await thing.writeProperty("status", state.status); } catch { }
  };

// SIMULAZIONE

// 1. Luce artificiale: se l'attuatore (lampadina) è acceso (+500 lux).
// 2. Luce naturale: se la finestra è aperta entra luce solare (+800 lux).
  const simInterval = setInterval(async () => {
    if (state.status !== "online") return;
    let target = 20;
    if (getLightActuatorState()) target += 500;
    if (getWindowState()) target += 800;
        
    await setIlluminanceLux(target);
  }, 5000);

  const stopSim = () => clearInterval(simInterval);

  return { thing, state, setIlluminanceLux, setStatus, stopSim };
}
