import WoT from 'wot-typescript-definitions';
import { AsyncUsbAdapter, UsbAdapter } from './utils/UsbAdapter';
import { wait } from './utils/wait';

//rmb: serial set to both NL & CR, so \r\n as end sequence
export class LampThing{
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    private usb!:AsyncUsbAdapter;

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
        this.usb= await this.connect("COM8")
        //Set handlers
        this.thing.setPropertyReadHandler("status",async ()=>{
            console.log("* handle property read: status");
            return await this.usb.writeAndRead("status")
        })
        this.thing.setActionHandler("toggle", async()=>{
            console.log("* handle action: toggle");
            return await this.usb.writeAndRead("toggle")
        })
        
        //Expose
        await this.thing.expose();
        console.log("Lamp thing started! Go to: http://localhost:8080/lamp");
    }
    private async connect(com:string){ //"COM8"
        if(this.usb!=null) await this.usb.stop()
        console.log("Connecting to lamp device...")
        const usb= new AsyncUsbAdapter(com,9600,{start:"$",stop:"\r\n"});
        await usb.start();
        const maxRetries=5;
        let retries=0;
        let resp="";
        while(resp!="pong" && retries<maxRetries){
            await wait(1000);
            try{
                //Check connection
                resp=(await usb.writeAndRead("ping")).trim();
                //console.log(`Ping response: ${resp}, length: ${resp.length}`);
            }
            catch(e){console.log(e)}
            finally{retries++;}
        }
        if(retries==maxRetries){
            throw new Error("Unable to connect to lamp via USB adapter, max retries reached")
        }
        const hello=await usb.writeAndRead("hello");
        console.log("Device online, welcome message:",hello)
        const status=await usb.writeAndRead("status");
        console.log("Read lamp status:",status)
        return usb;
    }
}

