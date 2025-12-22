import WoT from 'wot-typescript-definitions';
import { UsbAdapter } from './UsbAdapter';

export type ControlType= "analog"|"serial"

/*
Serial
$c:0 #control type
$ra:10,20,30,20,10 #set all rotations
$r12:90 #set single rotation
$g #getRotationAngles
$p:1 #0=deactivate serial print loop
Output
$da:10,20,30,50,10 #all rotations data
$d12:45 #single rotation data
$e:msg #errors
$l:log #general response or status
*/
export class RobotArm{
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    private usb!:UsbAdapter;
    private cache: Map<string,any>= new Map();
    private controlType:ControlType="analog";
    private comPort:string;
    public cacheOnly=false;

    constructor(
        runtime: typeof WoT,
        target: WoT.ThingDescription,
        comPort: string
    ){
        this.runtime= runtime;
        this.target= target;
        this.comPort= comPort;
    }
    async start(){
        this.thing= await this.runtime.produce(this.target);
        if (!this.cacheOnly) this.usb= new UsbAdapter(this.comPort,115200,{start:"$",stop:"\r\n"});
        //Handle servos
        for(let i=0; i<5; i++){
            const servoIndex= i+1;
            this.cache.set("servoRotation"+servoIndex,90);
            this.thing.setPropertyWriteHandler("servoRotation"+servoIndex, async (data)=>{
                const value= await data.value();
                try{
                    if (!this.cacheOnly) await this.usb.sendMessage("r"+servoIndex+":"+value);
                    this.cache.set("servoRotation"+servoIndex,value);
                }catch(e){
                    console.log(e)
                }
                //console.log("BESTIA")
            });
            this.thing.setPropertyReadHandler("servoRotation"+servoIndex, async ()=>{
                return this.cache.get("servoRotation"+servoIndex);
            });
        }
        //Handle control type
        this.thing.setPropertyWriteHandler("controlType", async (data)=>{
            const value= await data.value();
            const controlBit= (value as ControlType)=="analog"? 0:1;
            if(!this.cacheOnly)await this.usb.sendMessage("c:"+controlBit);
            this.controlType=value as ControlType;
        });
        this.thing.setPropertyReadHandler("controlType", async ()=>{
            return this.controlType;
        });
        //Handle reset arm
        this.thing.setActionHandler("resetPosition", async ()=>{
            if (!this.cacheOnly) await this.usb.sendMessage("r:90,90,90,90,90");
            return "ok";
        })

        //Handle errors
        if(!this.cacheOnly) this.usb.on("notification",async (data:string)=>{
            if(data.startsWith("e")){
                this.thing.emitEvent("genericError",data.split(":")[1]);
            }
        })


        //Expose
        if(!this.cacheOnly) await this.usb.start();
        await this.thing.expose();
        console.log("robot arm online!")
    }
}