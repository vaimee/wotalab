import WoT from 'wot-typescript-definitions';
import { UsbAdapter } from './UsbAdapter';
import { wait } from '../utils/wait';

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
    private comPort:string;
    //Online configuration
    private cfgNeedsUpdate=false;
    private controlType:ControlType="analog";

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
        
        //Handle servos
        for(let i=0; i<5; i++){
            const servoIndex= i+1;
            this.cache.set("servoRotation"+servoIndex,90);
            this.thing.setPropertyWriteHandler("servoRotation"+servoIndex, async (data)=>{
                const value= await data.value();
                if(this.controlType=="serial") this.cache.set("servoRotation"+servoIndex,value);
            });
            this.thing.setPropertyReadHandler("servoRotation"+servoIndex, async ()=>{
                return this.cache.get("servoRotation"+servoIndex);
            });
        }
        //Handle control type
        this.thing.setPropertyWriteHandler("controlType", async (data)=>{
            const value= await data.value();
            this.controlType=value as ControlType;
            this.cfgNeedsUpdate=true;
        });
        this.thing.setPropertyReadHandler("controlType", async ()=>{
            return this.controlType;
        });
        //Handle reset arm
        this.thing.setActionHandler("resetPosition", async ()=>{
            //await this.usb.sendMessage("r:90,90,90,90,90");
            return "ok";
        })

        //Handle errors
        /*this.usb.on("notification",async (data:string)=>{
            if(data.startsWith("e")){
                this.thing.emitEvent("genericError",data.split(":")[1]);
            }
        })*/


        //await this.usb.start();
        await this.connectDevice();
        this.loop();

        //Expose
        await this.thing.expose();
        console.log("robot arm thing exposed!")
    }

    async connectDevice(){
        console.log("connecting to device...")
        this.usb= new UsbAdapter(this.comPort,115200,{start:"$",stop:"\r\n"});
        this.usb.verbose=false;
        await this.usb.start();
        
        //Prepare
        console.log("waiting for hello message...")
        const helloMsg= await this.usb.waitNextMessage();
        console.log("received hello message: "+helloMsg)
        //Read angles
        await this.usb.sendMessage("g")
        const vec0=await this.usb.waitNextMessage();
        console.log("read initial rotations:",vec0)
        console.log("device online")
    }
    async loop(){
        const fs= 20;
        const Ts= 1/fs;
        let running=true;
        console.log("starting device loop, Fs:"+fs+"Hz...")
        while(running){
            try{
                if(this.cfgNeedsUpdate){
                    //Update configuration online, will cause a small lag spike but it's ok
                    const controlBit= this.controlType=="analog"? 0:1;
                    await this.usb.sendMessage("c:"+controlBit);
                    this.cfgNeedsUpdate=false;
                    continue;
                }
                if(this.controlType=="analog"){
                    //console.log("serial start")
                    //Manual control, read angles and update cache
                    await this.usb.sendMessage("g")
                    const anglesString= await this.usb.waitNextMessage();
                    if(!anglesString.startsWith("da:")){
                        console.log("skipping read angles, received different payload")
                        continue;
                    }
                    let angles= anglesString.split(":")[1].split(",").map((v)=>{return parseInt(v)});
                    for(let i=0; i<5; i++){
                        const servoID= "servoRotation"+(i+1)
                        this.cache.set(servoID,angles[i])
                    }
                    //console.log("serial end")
                }else{
                    //Remote control, read cache and update angles
                    const angles=[]
                    for(let i=0; i<5; i++){
                        const servoID= "servoRotation"+(i+1)
                        angles.push(this.cache.get(servoID));
                    }
                    const setAnglesString= ("ra:"+angles.join(",")).trim();
                    await this.usb.sendMessage(setAnglesString)
                }
            }catch(e){
                console.log(e)
            }finally{
                await wait(Ts*1000); //ms
            }
        }
    }
}