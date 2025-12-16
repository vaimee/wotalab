export class Filter{
    public type:"disabled"|"firstOrder"|"secondOrder";
    //Take x, curr velocity and u as input and produce updated x and velocity ([[x],[v]])
    private filters:{[k:string]:(x:number[],v:number[],forced_input:number[],dt:number,ignore_indices:number[],cfg:{[k:string]:any})=>(number[])[]};
    private filtersConfiguration:{[k:string]:any};
    //Save x(i) to be able to calculate x(i+1)= x(i)+f(x(i),u)
    private state_size:number=0;
    private curr_state:number[]|null=null;
    private curr_vel:number[]|null=null;
    constructor(type:"disabled"|"firstOrder"|"secondOrder",config?:{[k:string]:any}){
        this.type=type;
        this.filters={
            "disabled":this.identity,
            "firstOrder":this.lpf,
            "secondOrder":this.doublePole
        }
        this.filtersConfiguration=config?config:{
            "all":{
                "ignore_indices":[4]
            },
            "disabled":{},
            "firstOrder":{
                "tau":[0.5,0.5,0.5,0.5,0.5],
            },
            "secondOrder":{
                "wn":[8,8,8,8,8],
                "delta":[0.7,0.7,0.7,0.7,0.7],
                "mass":0.2
            }
        }
    }

    public resetState(){
        this.curr_state=null;
        this.curr_vel=null;
    }

    //Only outputs current state, velocity is only used internally to compute state
    public filterVec(forced_input:number[],dt:number):number[]{
        //First initialize state if needed
        if(!this.curr_state || forced_input.length!=this.state_size){ //either initialize or update if outdated cache
            this.state_size=forced_input.length;
            this.curr_state=[];
            for(let i=0; i<this.state_size; i++){
                this.curr_state.push(forced_input[i])
            }
        }
        if(!this.curr_vel || forced_input.length!=this.state_size){
            this.curr_vel=[];
            for(let i=0; i<this.state_size; i++){
                this.curr_vel.push(forced_input[i])
            }
        }
        //Apply filter specified in the type variable
        const cfg= this.filtersConfiguration[this.type];
        const ignore_indices= this.filtersConfiguration["all"]["ignore_indices"];
        const [next_state,next_vel]=this.filters[this.type](this.curr_state,this.curr_vel,forced_input,dt,ignore_indices,cfg);
        this.curr_state=next_state;
        this.curr_vel=next_vel;
        return next_state;
    }

    private identity(x:number[],v:number[],forced_input:number[],delta:number,ignore_indices:number[],config:{[key:string]:any}){
        let new_v:number[]=[]
        for(let i=0; i<x.length; i++){
            new_v[i]= 0; //(x[i]-(this.curr_state?this.curr_state[i]:0))/delta;
        }
        return [x,v];
    }
    
    private lpf(x:number[],v:number[],forced_input:number[],delta:number,ignore_indices:number[],config:{[key:string]:any}){
        const dt=delta;
        const tau= config["tau"]||[0.5,0.5,0.5,0.5,0.5]; //higher means slower
        const next_state= [0,0,0,0,0];
        //dx/dt= -kx + u
        //dx/dt= (v0-vinf)*exp(-t/tau) + vinf
        for(let i=0; i<5; i++){
            const dx= (1/tau[i]) * (forced_input[i]-x[i]);
            next_state[i]= x[i]+dx*dt;
        }
        for(let i=0; i<ignore_indices.length; i++){
            const idx= ignore_indices[i]
            //next_vel[idx]=0;
            next_state[idx]=forced_input[idx];
        }
        return [next_state,v]
    }
    
    private doublePole(x:number[],v:number[],forced_input:number[],delta:number,ignore_indices:number[],config:{[key:string]:any}){
        //const skipFilter= [4]; //do not slow down hand
        const dt=delta;
        const wn = config["wn"]||[8,8,8,8,8]
        const deltan = config["delta"]||[0.7,0.7,0.7,0.7,0.7];
        const m= config["mass"]||0.2;
        const next_state= [0,0,0,0,0];
        const next_vel=[0,0,0,0,0];
        //console.log(`### ${wn} ${deltan} ${m}`)
        //dx/dt= -kx + u
        //dx/dt= (v0-vinf)*exp(-t/tau) + vinf
        for(let i=0; i<5; i++){
            const k= wn[i]^2 * m;
            const b= 2*deltan[i]*wn[i]*Math.sqrt(m);
            const kp=k/m;
            const kd=b/m;
            const acc= ( -kd * v[i] + kp*(forced_input[i]-x[i]) );
            next_vel[i]=v[i]+acc*dt;
            next_state[i]= x[i]+v[i]*dt;
        }
        //console.log(`${x} ${next_state} ${next_vel}`)
        for(let i=0; i<ignore_indices.length; i++){
            const idx= ignore_indices[i]
            next_vel[idx]=0;
            next_state[idx]=forced_input[idx];
            //console.log("ignored index"+idx)
        }
        return [next_state,next_vel]       
    }    
}