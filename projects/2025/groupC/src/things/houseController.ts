import { loadTdJson } from "../td/loadTd.js";

type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type HouseControllerState = {
  currentMode: "HOME" | "NIGHT" | "ECO" | "AWAY";
  alarmActive: boolean;
  alarmReason: string;

  targetTemperatureHome: number;
  targetTemperatureNight: number;
  targetTemperatureEco: number;
  targetTemperatureAway: number;
};

export async function createHouseController(wot: WoTLike) {
  const td = loadTdJson("house-controller.tm.json");
  const thing = await wot.produce(td);

  const state: HouseControllerState = {
    currentMode: "HOME",
    alarmActive: false,
    alarmReason: "Everything is OK",

    targetTemperatureHome: 22.0,
    targetTemperatureNight: 19.0,
    targetTemperatureEco: 18.0,
    targetTemperatureAway: 15.0,
  };

  thing.setPropertyReadHandler("currentMode", async () => state.currentMode);
  thing.setPropertyWriteHandler("currentMode", async (v: any) => {
    state.currentMode = await v.value();
  });

  thing.setPropertyReadHandler("alarmActive", async () => state.alarmActive);
  thing.setPropertyReadHandler("alarmReason", async () => state.alarmReason);



  thing.setPropertyReadHandler("targetTemperatureHome", async () => state.targetTemperatureHome);
  thing.setPropertyWriteHandler("targetTemperatureHome", async (v: any) => {
    state.targetTemperatureHome = Number(await v.value());
  });

  thing.setPropertyReadHandler("targetTemperatureNight", async () => state.targetTemperatureNight);
  thing.setPropertyWriteHandler("targetTemperatureNight", async (v: any) => {
    state.targetTemperatureNight = Number(await v.value());
  });

  thing.setPropertyReadHandler("targetTemperatureEco", async () => state.targetTemperatureEco);
  thing.setPropertyWriteHandler("targetTemperatureEco", async (v: any) => {
    state.targetTemperatureEco = Number(await v.value());
  });

  thing.setPropertyReadHandler("targetTemperatureAway", async () => state.targetTemperatureAway);
  thing.setPropertyWriteHandler("targetTemperatureAway", async (v: any) => {
    state.targetTemperatureAway = Number(await v.value());
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
