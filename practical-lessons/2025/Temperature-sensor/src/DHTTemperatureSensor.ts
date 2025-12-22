import WoT from 'wot-typescript-definitions';
import { UsbAdapter } from './UsbAdapter';

export class DHTTemperatureSensor{
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    private usb!:UsbAdapter;
    private cache: Map<string,any>= new Map();

    constructor(
        runtime: typeof WoT,
        target: WoT.ThingDescription,
    ){
        this.runtime= runtime;
        this.target= target;
    }
    async start(){
        this.thing= await this.runtime.produce(this.target);
        this.usb= new UsbAdapter("COM6",9600,{start:"$",stop:"\r\n"});
        this.usb.on("notification",async (data)=>{
            const arr= data.split(",");
            const temp= parseFloat(arr[0].split(":")[1].trim());
            const hum= parseFloat(arr[1].split(":")[1].trim());
            console.log("Temperature: "+temp+"°C, Humidity: "+hum+"%")
            if(temp!=this.cache.get("temperature")){
                this.cache.set("temperature",temp);
                this.thing.emitPropertyChange("temperature");
            }
            if(hum!=this.cache.get("humidity")){
                this.cache.set("humidity",hum);
                this.thing.emitPropertyChange("humidity");
            }
        })
        this.thing.setPropertyReadHandler("temperature",async ()=>{
            return this.cache.get("temperature");
        })
        this.thing.setPropertyReadHandler("humidity",async ()=>{
            return this.cache.get("humidity");
        })
        //Expose
        await this.usb.start();
        await this.thing.expose();
        console.log("DHT online!")
    }
}