import { loadTdJson } from "../td/loadTd.js";

type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type HouseControllerState = {
  currentMode: "HOME" | "NIGHT" | "ECO" | "VACATION";
  alarmActive: boolean;
  alarmReason: string;
  simulationEnabled: boolean;
};

export async function createHouseController(wot: WoTLike) {
  const td = loadTdJson("house-controller.tm.json");
  const thing = await wot.produce(td);

  const state: HouseControllerState = {
    currentMode: "HOME",
    alarmActive: false,
    alarmReason: "Everything is OK",
    simulationEnabled: true,
  };

  thing.setPropertyReadHandler("currentMode", async () => state.currentMode);
  thing.setPropertyWriteHandler("currentMode", async (v: any) => {
    state.currentMode = await v.value();
  });

  thing.setPropertyReadHandler("alarmActive", async () => state.alarmActive);
  thing.setPropertyReadHandler("alarmReason", async () => state.alarmReason);

  thing.setPropertyReadHandler("simulationEnabled", async () => state.simulationEnabled);
  thing.setPropertyWriteHandler("simulationEnabled", async (v: any) => {
    state.simulationEnabled = Boolean(await v.value());
  });

  thing.setActionHandler("setMode", async (v: any) => {
    state.currentMode = await v.value();
    return true;
  });

  thing.setActionHandler("resetAlarm", async () => {
    state.alarmActive = false;
    state.alarmReason = "Everything is OK";
    return true;
  });

  const triggerAlarm = async (reason: string) => {
    if (!state.alarmActive) {
      state.alarmActive = true;
      state.alarmReason = reason;
      thing.emitEvent("alarmTriggered", { 
        reason, 
        timestamp: new Date().toISOString() 
      });
      console.warn("ALARM TRIGGERED:", reason);
    }
  };

  return { thing, state, triggerAlarm };
}
