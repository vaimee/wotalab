import WoT from 'wot-typescript-definitions';

export class CounterThing{
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    private verbose: boolean= false;

    private count: number=0;

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
        this.thing.setPropertyReadHandler("count", async () => { 
            if(this.verbose) console.log("> read count: "+this.count)
            return this.count; 
        });
        this.thing.setActionHandler("increment", async () => { 
            this.count++; 
            if(this.verbose) console.log("< increment count to: "+this.count)
            this.thing.emitPropertyChange("count");
            return "ok"; 
        });
        this.thing.setActionHandler("reset", async () => { 
            this.count=0; 
            if(this.verbose) console.log("< reset count to: "+this.count)
            this.thing.emitPropertyChange("count");
            return "ok"; 
        });
        
        //Expose
        await this.thing.expose();
        console.log("Counter thing started! Go to: http://localhost:8080/counter");
    }
}

