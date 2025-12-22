import WoT from 'wot-typescript-definitions';
import { spawn } from "child_process";
import { wait } from '../utils/wait';

export class Controller{
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    private cache: Map<string,any>= new Map();
    private pollCache: Map<string,any>= new Map();
    private currPythonProcess:any;

    public verbose=false;

    constructor(
        runtime: typeof WoT,
        target: WoT.ThingDescription,
    ){
        this.runtime= runtime;
        this.target= target;
        process.on("exit",()=>{
            console.log("exiting controller adapter")
            if(this.currPythonProcess) this.currPythonProcess.kill();
        })
    }

    async start(){
        this.thing= await this.runtime.produce(this.target);
        this.thing.setPropertyReadHandler("analogLever",async ()=>{
            return {
                x: this.cache.get("ABS_X")?parseInt(this.cache.get("ABS_X")):0,
                y: this.cache.get("ABS_Y")?parseInt(this.cache.get("ABS_Y")):0
            }
        })
        this.thing.setPropertyReadHandler("analogLeverRight",async ()=>{
            return {
                x: this.cache.get("ABS_RX")?parseInt(this.cache.get("ABS_RX")):0,
                y: this.cache.get("ABS_RY")?parseInt(this.cache.get("ABS_RY")):0
            }
        })
        this.thing.setPropertyReadHandler("trigger",async ()=>{
            return this.cache.get("BTN_TL")=="1";
        })
        this.thing.setPropertyReadHandler("triggerRight",async ()=>{
            return this.cache.get("BTN_TR")=="1";
        })
        this.thing.setPropertyReadHandler("zLever",async ()=>{
            return this.cache.get("ABS_Z")?parseInt(this.cache.get("ABS_Z")):0;
        })
        this.thing.setPropertyReadHandler("zLeverRight",async ()=>{
            return this.cache.get("ABS_RZ")?parseInt(this.cache.get("ABS_RZ")):0;
        })
        this.thing.setPropertyReadHandler("buttonSouth",async ()=>{
            return this.cache.get("BTN_SOUTH")==1;
        })

        //RUN
        this.runPythonScript("./src/controller/DeviceInputApiLogger.py",["controller"]);
        console.log("waiting for controller to start...")
        await wait(500);
        console.log("starting device loop...")
        this.poll();
        //Expose
        await this.thing.expose();
        console.log("controller thing exposed!")
    }
    async poll(){
        
        for(const entry of this.cache.entries()){
            const code= entry[0];
            const value= entry[1];
            //this.cache.delete(code);
            //this.thing.emitPropertyChange()
            if(!this.pollCache.has(code)){
                //*added property, notify and add to poll cache
                await this.notifyEvent(code);
                this.pollCache.set(code,value);
                await this.wait(20)
            }else{
                //check if modified
                const pollVal= this.pollCache.get(code);
                if(pollVal!=value){
                    //*notify and add to poll cache!
                    await this.notifyEvent(code);
                    this.pollCache.set(code,value);
                    await this.wait(20)
                }
            }
        }
        await this.wait(10);
        this.poll();
    }
    async notifyEvent(code:string){
        switch (code) {
            case "ABS_X":
                this.thing.emitPropertyChange("analogLever")
                break;
            case "ABS_Y":
                this.thing.emitPropertyChange("analogLever")
                break;
            case "ABS_RX":
                this.thing.emitPropertyChange("analogLeverRight")
                break;
            case "ABS_RY":
                this.thing.emitPropertyChange("analogLeverRight")
                break;
            case "BTN_TL":
                this.thing.emitPropertyChange("trigger")
                break;
            case "BTN_TR":
                this.thing.emitPropertyChange("triggerRight")
                break;
            case "ABS_Z":
                this.thing.emitPropertyChange("zLever")
                break;
            case "ABS_RZ":
                this.thing.emitPropertyChange("zLeverRight")
                break;
            case "BTN_SOUTH":
                this.thing.emitPropertyChange("buttonSouth")
                break;
            default:
                break;
        }
    }
    async onControllerMessage(data:string){
        if(this.verbose) console.log("(gamepad) "+data);
        if(data.startsWith("Type")){
            const arr= data.split(",");
            const code= arr[1].split(":")[1].trim();
            const value= arr[2].split(":")[1].trim();
            //if(this.cache.has(code)) this.cache.delete(code);
            this.cache.set(code,value);
            return;
        }
    }
    async runPythonScript(scriptPath: string, args: string[] = []): Promise<void>{
        return new Promise((resolve,reject)=>{
            const currPythonProcess = spawn("python3", ["-u",scriptPath, ...args]);
            const father=this;
            currPythonProcess.on("spawn",()=>{
                console.log("sawned python script!");
            })
            currPythonProcess.stdout.on("data",(data)=>{
                //console.log({data:data.toString()})
                const chunks= data.toString().split("\r\n");
                for(const chunk of chunks){
                    if(chunk&&chunk!="") father.onControllerMessage(chunk);
                }
            })
            currPythonProcess.stderr.on("data",(error)=>{
                console.log("error: ",error.toString())
                reject();
            })
            currPythonProcess.on("exit",()=>{
                console.log("python script exited gracefully!")
                resolve();
            })
        })
    }
    async stop(){
        if(this.currPythonProcess) this.currPythonProcess.kill();
    }
    private async wait(ms:number){
        return new Promise(resolve=>{
            setTimeout(resolve,ms);
        })
    }
}