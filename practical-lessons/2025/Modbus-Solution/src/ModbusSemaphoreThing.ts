import WoT from 'wot-typescript-definitions';
const ModbusRTU= require("modbus-serial")

type SemaphoreColor = "red" | "yellow" | "green";

export class ModbusSemaphoreThing {
    private runtime: typeof WoT;
    // Exposed thing
    private proxy: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    // Consumed thing
    private target: WoT.ThingDescription;
    private remote!: WoT.ConsumedThing;

    private verbose: boolean = true;

    constructor(
        runtime: typeof WoT,
        proxy: WoT.ThingDescription,
        target: WoT.ThingDescription,
    ){
        this.runtime = runtime;
        this.proxy = proxy;
        this.target = target;
    }

    async start() {
        //TEST
        await this.testModbus()
        // Setup
        this.thing = await this.runtime.produce(this.proxy);
        this.remote = await this.runtime.consume(this.target);

        // Property read handler
        this.thing.setPropertyReadHandler("color", async () => { 
            const propVal= await this.remote.readProperty("rawState")
            const raw = await propVal.value() as any;
            const colorName = this.mapIndexToColor(raw);
            if(this.verbose) console.log(`> read color: ${colorName} (raw=${raw})`);
            return colorName; 
        });

        // Action handler
        this.thing.setActionHandler("setColor", async (data) => {
            const value = await data.value();
            const colorName = value?.toString() as SemaphoreColor;
            const colorIndex = this.mapColorToIndex(colorName);

            await this.remote.writeProperty("rawState", colorIndex);
            if(this.verbose) console.log(`< set color: ${colorName} (raw=${colorIndex})`);

            // Notify subscribers
            this.thing.emitPropertyChange("color");
            return "ok"; 
        });

        // Expose
        await this.thing.expose();
        console.log("Semaphore thing started! Go to: http://localhost:8080/semaphore");
    }

    async testModbus() {
        const client = new ModbusRTU();
        const host="127.0.0.1";
        const port= 8502;
        console.log("Testing modbus device connection ("+host+":"+port+")...")
        try {
            // Connetti al mock server TCP
            await client.connectTCP(host, { port });
            client.setID(1); // unitID del tuo server

            // Leggi il holding register 0
            const data = await client.readHoldingRegisters(0, 1);
            console.log("Value of reg 0:", data.data[0]); // dovrebbe essere 0 (rosso iniziale)

            // Scrivi un nuovo valore (es. 1 = yellow)
            await client.writeRegister(0, 1);
            console.log("Wrote 1 in reg 0");

            // Rileggi il registro per confermare
            const newData = await client.readHoldingRegisters(0, 1);
            console.log("New value of reg 0:", newData.data[0]); // dovrebbe essere 1

            //reset
            await client.writeRegister(0, 0);
            console.log("Reset reg 0"); // dovrebbe essere 1
        } catch (err) {
            console.error("Client Modbus error:", err);
        } finally {
            client.close();
        }
    }

    mapColorToIndex(color: SemaphoreColor): number {
        switch (color) {
            case "red": return 0;
            case "yellow": return 1;
            case "green": return 2;
            default: return 0;
        }
    }

    mapIndexToColor(index: number): SemaphoreColor {
        switch (index) {
            case 0: return "red";
            case 1: return "yellow";
            case 2: return "green";
            default: return "red";
        }
    }
}
