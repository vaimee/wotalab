import { Filter } from "./SignalProcessing";
import { wait } from "../utils/wait";


export class RobotArmController{
    private robotArm!:WoT.ConsumedThing;
    private inputController!:WoT.ConsumedThing;

    private inputs!:GamepadInputsCache;
    private inputsMapper!:InputsRotationMapper;
    private filter!:Filter;

    private controlType="analog";

    constructor(
        private runtime:typeof WoT, 
        private robotArmTD:WoT.ThingDescription, 
        private inputControllerTD:WoT.ThingDescription
    ){}

    async start(){
        console.log("creating consumed things...")
        this.robotArm= await this.runtime.consume(this.robotArmTD)
        this.inputController= await this.runtime.consume(this.inputControllerTD)   

        //Data structures
        this.inputs= new GamepadInputsCache();
        this.inputsMapper= new InputsRotationMapper(this.inputs);
        this.filter= new Filter("secondOrder");
        
        //Run
        //await this.test()
        this.loop()
    }

    private async loop(){
        const fs=30;
        const Ts=1/fs;
        let running=true;

        console.log("starting orchestrator loop, Fs: "+fs+"Hz...")
        this.handleButtonInputs()
        while(running){
            //Handle input events
            if(this.inputs.isKeyPressed("buttonSouth")){
                //Switch control type (manual/remote)
                this.controlType= (this.controlType=="serial")?"analog":"serial";
                await this.robotArm.writeProperty("controlType",this.controlType);
                console.log("switched control type to: "+this.controlType)
            }

            //Fetch and update analog inputs
            const istart= performance.now()
            await this.updateAnalogInputs();
            const itime= performance.now()-istart; //ms
            // Process
            // normalize inputs as [x | x bl 0:1)] and map to desired rotations (r(t))
            const desiredRotations= this.inputsMapper.getDesiredRotation(Ts);
            //filter (disabled, first or second order)
            const rotations = this.filter.filterVec(desiredRotations,Ts) 
            //Correct state with post processed rotation
            this.inputsMapper.setActualRotation(rotations);

            //Write output
            const ostart= performance.now()
            await this.writeOutputVector(rotations);
            const otime= performance.now()-ostart;

            await wait(Ts*1000)
        }
    }

    private async updateAnalogInputs(){
        const analogStickThereshold=4000;
        const res= await this.inputController.readMultipleProperties(["analogLever","analogLeverRight","zLeverRight"])
        
        const analogLever= await res.get("analogLever")?.value() as any//await (await this.inputController.readProperty("analogLever")).value() as any
        const analogLeverRight= await res.get("analogLeverRight")?.value() as any //await (await this.inputController.readProperty("analogLeverRight")).value() as any
        const zLeverRight= await res.get("zLeverRight")?.value() as any//await (await this.inputController.readProperty("zLeverRight")).value() as any
        

        const lx= Math.abs(analogLever.x)<analogStickThereshold?0:analogLever.x
        const ly= Math.abs(analogLever.y)<analogStickThereshold?0:analogLever.y
        this.inputs.setInput("analogLever",{x:lx,y:ly})
        
        const lrx= Math.abs(analogLeverRight.x)<analogStickThereshold?0:analogLeverRight.x
        const lry= Math.abs(analogLeverRight.y)<analogStickThereshold?0:analogLeverRight.y
        this.inputs.setInput("analogLeverRight",{x:lrx,y:lry})
        
        this.inputs.setInput("zLeverRight",zLeverRight)
    }
    private async handleButtonInputs(){
        const properties=["buttonSouth","trigger","triggerRight"]
        for(const propertyID of properties){
            this.inputController.observeProperty(propertyID,async (data)=>{
                const buttonPressed= (await data.value()) as boolean;
                this.inputs.setKeyPressed(propertyID,buttonPressed)
            })
        }

        //this.inputController.observeProperty("buttonSouth",async (data:any)=>{
        //    const propertyValue= await data.value();
        //    console.log(propertyValue)
        //})
    }

    private async writeOutputVector(vec:number[]){
        for(let i=0; i<5;i++){
            await this.robotArm.writeProperty("servoRotation"+(i+1),Math.round(vec[i]));
        }
    }


    /*
    private getNormalizedInputVectorOLD():number[]{
        //0=servorot1, 1=servorot2, ..., 4=servorot5
        const inputs=[
            this.inputs.getInput("analogLever").x,
            this.inputs.getInput("analogLever").y,
            this.inputs.getInput("analogLeverRight").x,
            this.inputs.getInput("analogLeverRight").y,
            this.inputs.getInput("zLeverRight")
        ]
        const normalized=[0,0,0,0,0];
        for(let i=0; i<5;i++){
            if(i!=4){
                normalized[i]=((inputs[i]-this.analogLeverMin)/(this.analogLeverMax-this.analogLeverMin))
            }else{
                normalized[4]=inputs[4]/this.zLeverMax;
            }
        }
        return normalized;
    }

    private async handleButtonsOLD(){
        let controlType="analog";
        this.inputController.observeProperty("buttonSouth", async (data)=>{
            const buttonPressed= (await data.value()) as boolean;
            //console.log()
            if(buttonPressed){
                if(controlType=="analog"){
                    await this.robotArm.writeProperty("controlType","serial")
                    controlType="serial"
                }else{
                    await this.robotArm.writeProperty("controlType","analog")
                    controlType="analog"
                }
            }
        })
    }

    private async getInputAsVectorOLD():Promise<number[]>{
        const inputs=[0,0,0,0,0]
        const analogLever=await (await this.inputController.readProperty("analogLever")).value() as any
        const lx= Math.abs(analogLever.x)<this.analogStickThereshold?0:analogLever.x
        const ly= Math.abs(analogLever.y)<this.analogStickThereshold?0:analogLever.y
        inputs[0]=lx;
        inputs[1]=ly;
        const analogLeverRight=await (await this.inputController.readProperty("analogLeverRight")).value() as any
        const lrx= Math.abs(analogLeverRight.x)<this.analogStickThereshold?0:analogLeverRight.x
        const lry= Math.abs(analogLeverRight.y)<this.analogStickThereshold?0:analogLeverRight.y
        inputs[2]=lrx;
        inputs[3]=lry;
        const zLeverRight=await (await this.inputController.readProperty("zLeverRight")).value() as any
        inputs[4]=zLeverRight;
        return inputs;
    }
    */


    //Test and path management
    private async test(){
        const pathGen= new PathGenerator();
        console.log("testing system...")
        console.log("fetching angles...")
        //await this.robotArm.readProperty("")
        console.log("setting robot arm control to serial...")
        await this.robotArm.writeProperty("controlType","serial");
        const vec0= [90,90,90,90,55];
        const p1= pathGen.doubleRampVecInt(vec0,0,90,0);
        await this.writePath(p1,100);
    }
    private async writePath(path:(number[])[],dt:number=20){
        for(const vec of path){
            await wait(dt);
            console.log(`path - ${vec}`)
            await this.writeOutputVector(vec);
        }
    }
}



//todo: this way it cannot handle parallel isKeyPressed requests, not a prob for now
class GamepadInputsCache{
    private inputs_map:{[key:string]:any}={}; //string,int or {x,y}
    private pressed_keys:string[]=[];
    private requested_keys:string[]=[];

    setInput(key:string,value:any){
        this.inputs_map[key]=value;
    }
    getInput(key:string){
        return this.inputs_map[key];
    }

    setKeyPressed(key:string,value:boolean){
        if(value){
            //manage press
            if(!this.pressed_keys.includes(key)){
                this.pressed_keys.push(key);
                //console.log("pressed keys:",this.pressed_keys)
            }
        }else{
            //manage not press
            if(this.pressed_keys.includes(key)){
                const idx= this.pressed_keys.indexOf(key)
                if(idx!=-1){
                    const N=this.pressed_keys.length;
                    this.pressed_keys=this.pressed_keys.slice(0,idx)
                        .concat(this.pressed_keys.slice(idx+1,N))
                }
                //console.log("pressed keys after release:",this.pressed_keys)
            }
            //Always remove from requested if unpressed
            if(this.requested_keys.includes(key)){
                const idx= this.requested_keys.indexOf(key)
                if(idx!=-1){
                    const N=this.requested_keys.length;
                    this.requested_keys=this.requested_keys.slice(0,idx)
                        .concat(this.requested_keys.slice(idx+1,N))
                }
            }
        }

    }
    //Stays up for all press duration
    getKeyPress(key:string){
        return this.pressed_keys.includes(key)
    }
    //Triggers only once during press
    isKeyPressed(key:string):boolean{
        if(this.pressed_keys.includes(key)){
            //console.log("is key pressed:",this.pressed_keys,"req:",this.requested_keys)
            if(!this.requested_keys.includes(key)){
                //if first time, add to requested
                this.requested_keys.push(key)
                return true;
            }else{
                //key pressed but already requested, return false to allow detection of "fronte di salita"
                return false;
            }
        }
        return false;
    }
}

//Maps input property values to target rotation
class InputsRotationMapper{
    private analogLeverMax=32767
    private analogLeverMin=-32768
    private zLeverMax=255
    private zLeverMin=0

    private type:"positional"|"inertial"="positional";

    //used to map rotations from velocity. for positional systems convert directly position
    private state0= [90,90,90,90,55];
    private curr_state:number[]|null=null;

    constructor(private inputs:GamepadInputsCache){

    }

    public getDesiredRotation(dt:number):number[]{
        let rot=[0,0,0,0,0]
        if(this.type=="positional"){
            const norm= this.getNormalizedInputVectorV2();
            rot= this.mapInputsToRotations(norm);
        }else{
            //Calc velocity, then update
            const nvel= this.getNormalizedVelocityVector();
            rot= this.mapVelocitiesToRotations(nvel,dt);
        }
        return rot;
    }
    public setActualRotation(rot:number[]){
        this.curr_state=rot.map(r=>r); //copy
    }

    //INERTIAL
    private getNormalizedVelocityVector(){
        //bl to (-1,1) and not 0-1
        const normalized=[0,0,0,0,0];

        const normTrigger= this.inputs.getKeyPress("trigger")?1:0
        const normTriggerRight= this.inputs.getInput("triggerRight")?1:0
        normalized[0]= normTriggerRight-normTrigger //base

        //Flip left y
        normalized[1]= -2*this.inputs.getInput("analogLever").y/(this.analogLeverMax-this.analogLeverMin)
        //keep normal right y
        normalized[2]= 2*this.inputs.getInput("analogLeverRight").y/(this.analogLeverMax-this.analogLeverMin) //servo1

        //Hand rotation normal also
        normalized[3]=0

        normalized[4]= this.inputs.getInput("zLeverRight")/this.zLeverMax; //!bl to 0-1

        return normalized;
    }
    private mapVelocitiesToRotations(normVel:number[],dt:number){
        const skipIdx=[4];
        if(this.curr_state==null){
            this.curr_state=[];
            for(let i=0; i<this.state0.length; i++){
                this.curr_state[i]=this.state0[i];
            }
        }
        //If curr state present, update x(i+1)= x(i) + v*dt
        const next_rotations:number[]=[];
        for(let i=0; i<normVel.length;i++){
            next_rotations[i]= this.curr_state[i] + 5000*normVel[i]*dt;
        }
        //interpret as instant rotation
        for(let i=0; i<skipIdx.length;i++){
            const idx= skipIdx[i];
            next_rotations[idx]=normVel[idx]
        }
        return next_rotations;
    }

    //POSITIONAL
    private getNormalizedInputVectorV2():number[]{
        const inputs=[
            this.inputs.getInput("analogLever").x,
            this.inputs.getInput("analogLever").y*-1,
            this.inputs.getInput("analogLeverRight").y,
            this.inputs.getInput("analogLeverRight").x,
            this.inputs.getInput("zLeverRight")
        ]
        const normalized=[0,0,0,0,0];
        for(let i=0; i<5;i++){
            if(i!=4){
                normalized[i]=((inputs[i]-this.analogLeverMin)/(this.analogLeverMax-this.analogLeverMin))
            }else{
                normalized[4]=inputs[4]/this.zLeverMax;
            }
        }   
        return normalized;     
    }
    private getNormalizedInputVectorV1():number[]{
        //0=servorot1, 1=servorot2, ..., 4=servorot5
        const inputs=[
            this.inputs.getInput("analogLever").x,
            this.inputs.getInput("analogLever").y,
            this.inputs.getInput("analogLeverRight").x,
            this.inputs.getInput("analogLeverRight").y,
            this.inputs.getInput("zLeverRight")
        ]
        const normalized=[0,0,0,0,0];
        for(let i=0; i<5;i++){
            if(i!=4){
                normalized[i]=((inputs[i]-this.analogLeverMin)/(this.analogLeverMax-this.analogLeverMin))
            }else{
                normalized[4]=inputs[4]/this.zLeverMax;
            }
        }
        return normalized;
    }
    private mapInputsToRotations(normInputs:number[]){
        //normInputs: [ax,ay, arx,ary, zlever]
        //1-4 rotate 180deg, 5 rotates 55 deg -> hand
        const rotations=[0,0,0,0,0];
        for(let i=0;i<5;i++){
            if(i!=4){
                rotations[i]= 180*normInputs[i];
            }else{
                rotations[i]= (55*normInputs[i])+55;
            }
        }
        return rotations;
    }
}


//Others
class PathGenerator{
    public doubleRampVecInt(vec0:number[],idx:number,x0:number,x1:number){
        const ch1= this.rampVecInt(vec0,idx,x0,x1);
        const N= ch1.length;
        const lastvec= ch1[N-1];
        const ch2= this.rampVecInt(lastvec,idx,x1,x0);
        return ch1.concat(ch2);
    }
    public rampVecInt(vec0:number[],idx:number,x0:number,x1:number){
        const d=x1-x0;
        const mod= Math.abs(d)
        const n= d/mod;
        const out:(number[])[]=[];
        for(let i=0; i<mod+1; i++){
            const newvec= [vec0[0],vec0[1],vec0[2],vec0[3],vec0[4]];
            newvec[idx]= x0+(n*i);
            out.push(newvec);
        }
        return out;
    }
}