import WoT from 'wot-typescript-definitions';

type SemaphoreColor = "red" | "yellow" | "green";

export class SemaphoreThing{
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    private verbose: boolean= false;

    private color: SemaphoreColor="red";

    constructor(
        runtime: typeof WoT,
        target: WoT.ThingDescription,
    ){
        this.runtime= runtime;
        this.target= target;
    }
    async start(){
        //Setup
        this.thing= await this.runtime.produce(this.target);
        //Set handlers
        this.thing.setPropertyReadHandler("color", async () => { 
            if(this.verbose) console.log("> read color: "+this.color)
            return this.color; 
        });
        this.thing.setActionHandler("setColor", async (data)=>{
            const value= await data.value();
            this.color= value?.toString() as SemaphoreColor;
            if(this.verbose) console.log("< set color: "+this.color)
            this.thing.emitPropertyChange("color");
            return "ok"; 
        });
        
        //Expose
        await this.thing.expose();
        console.log("Semaphore thing started! Go to: http://localhost:8080/semaphore");
    }
}

