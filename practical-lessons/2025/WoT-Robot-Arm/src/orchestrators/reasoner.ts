import {Servient} from "@node-wot/core"
import {HttpClientFactory} from "@node-wot/binding-http"

let controlType="analog"
const analogStickThereshold=4000;
const S1= 180/65535;
const q1= S1*32767;

const S2= 55/255;
const q2= 35+20;

export class Reasoner{
    async start(){
        const servient = new Servient();
        servient.addClientFactory(new HttpClientFactory(null));
        const wotRuntime= await servient.start();
        const robotArmTd= await wotRuntime.requestThingDescription("http://localhost:8080/robotarm");
        const controllerTd= await wotRuntime.requestThingDescription("http://localhost:8080/controller");
        const robotArm= await wotRuntime.consume(robotArmTd)
        const controller= await wotRuntime.consume(controllerTd)

        controller.observeProperty("analogLever", async (data)=>{
            const val:any= await data.value();
            const x= Math.abs(val.x)<analogStickThereshold?0:val.x
            const y= Math.abs(val.y)<analogStickThereshold?0:val.y
            const servo1Rotation= Math.round((x*S1) + q1);
            const servo2Rotation= Math.round((y*S1) + q1);
            await robotArm.writeProperty("servoRotation1",servo1Rotation)
            await this.wait(20)
            await robotArm.writeProperty("servoRotation2",servo2Rotation)
        })
        controller.observeProperty("analogLeverRight", async (data)=>{
            const val:any= await data.value();
            const x= Math.abs(val.x)<analogStickThereshold?0:val.x
            const y= Math.abs(val.y)<analogStickThereshold?0:val.y
            const servo3Rotation= Math.round((y*S1) + q1);
            const servo4Rotation= Math.round((x*S1) + q1);
            await robotArm.writeProperty("servoRotation3",servo3Rotation)
            await this.wait(20)
            await robotArm.writeProperty("servoRotation4",servo4Rotation)
        })
        controller.observeProperty("zLeverRight", async (data)=>{
            const z:number= (await data.value()) as number;
            const servo5Rotation= Math.round((z*S2) + q2);
            await robotArm.writeProperty("servoRotation5",servo5Rotation)
        })
        controller.observeProperty("buttonSouth", async (data)=>{
            const buttonPressed= (await data.value()) as boolean;
            if(buttonPressed){
                if(controlType=="analog"){
                    await robotArm.writeProperty("controlType","serial")
                    controlType="serial"
                }else{
                    await robotArm.writeProperty("controlType","analog")
                    controlType="analog"
                }
            }
        })


        /*
        .then(async (WoT) => {
            const td = await WoT.requestThingDescription("http://localhost:8080/counter");
            // Then from here on you can consume the thing
            let thing = await WoT.consume(td);
            thing.observeProperty("count", async (data) => { console.log("count:", await data.value()); });
            for (let i = 0; i < 5; i++) {
                await thing.invokeAction("increment");
            }
        }).catch((err) => { console.error(err); });
        */
    }

    private async wait(ms:number){
        return new Promise(resolve=>{
            setTimeout(resolve,ms);
        })
    }

}