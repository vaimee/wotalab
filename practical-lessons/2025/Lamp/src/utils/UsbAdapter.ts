import EventEmitter from "events";
import {SerialPort} from "serialport"

export class UsbAdapter extends EventEmitter{
    private write_busy=false;
    private port:any;
    private PORT:string;
    private BAUD:number;
    private verbose:boolean;
    private start_message_sequence: string;
    private end_message_sequence: string;

    constructor(PORT:string, BAUD:number, messageDelimiters: {
        start: string,
        stop: string,
    },verbose=false){
        super();
        this.PORT=PORT;
        this.BAUD=BAUD;
        this.verbose=verbose;
        this.start_message_sequence= messageDelimiters.start; //"$start,";
        this.end_message_sequence= messageDelimiters.stop; //"\n";
        this.port={};
    }


    async stop():Promise<void>{
        return new Promise(resolve=>{
            this.port.close(function (err:any) {
                console.log('port closed', err);
                resolve()
            });
        })
    }

    async start():Promise<void>{
        return new Promise((resolve,reject)=>{
            this.port = new SerialPort({
                path: this.PORT,
                baudRate: this.BAUD
            })
            //this.port.on("close",(err:any)=>{console.log(err)})
            this.port.on("open",()=>{
                console.log(`Usb adapter connected to port ${this.PORT}, baudRate: ${this.BAUD}`)
                resolve()
            })    
            let buffer="";
            let msgStarted=false;
            const sms= this.start_message_sequence;
            const ems= this.end_message_sequence;
            const father= this;
            this.port.on("data",(data:any)=>{
                //console.log("received serial data: "+data.toString())
                buffer= buffer + data.toString();
                //console.log("Buffer:",{data:buffer})
                //Check if message is starting
                if(!msgStarted){
                    if(buffer.includes(sms)){
                        msgStarted=true;
                        const splittedArr= buffer.split(sms);
                        buffer= splittedArr.length>1? splittedArr[1]:"";
                    }else{
                        if(buffer.length>sms.length) buffer="" //prevent buffer overflow 
                    }
                }

                //Check if message is finished
                if(msgStarted){
                    if(buffer.includes(ems)){
                        msgStarted=false;
                        const splittedArr= buffer.split(ems)
                        let newData= splittedArr[0] //remove end message characters
                        father.onMessage(newData)
                        buffer= splittedArr.length>1?splittedArr[1]:""; //empty buffer
                    }
                }
            });
        })
    }

    async onMessage(data: string){
        if(this.verbose)console.log("> adapter received raw message: "+data);
        this.emit("notification",data);
    }


    async sendMessage(data: string): Promise<void>{
        if(this.write_busy){
            console.log("error: serial is busy, ignoring message");
            return;
        }
        const father=this;
        father.write_busy=true;
        const fullMsg=this.start_message_sequence+data+this.end_message_sequence
        if(this.verbose) console.log("< adapter sending raw message: "+data);
        return new Promise((resolve,reject)=>{
            this.port.write(fullMsg, function(err:any) {
                if (err) reject('Error on write: ' + err.message)
                //console.log('message written')
                father.write_busy=false;
                resolve();
            })
        })
    }
}

export class AsyncUsbAdapter extends UsbAdapter{
    async writeAndRead(data:string,timeoutMs=5000):Promise<string>{
        return new Promise((resolve,reject)=>{
            let resolved=false;
            const cb= async (response:string)=>{
                this.removeListener("notification",cb)
                resolved=true;
                resolve(response);
            }
            this.addListener("notification",cb)
            this.sendMessage(data);
            setTimeout(()=>{
                if(resolved) return;
                this.removeListener("notification",cb)
                reject("timeout")
            },timeoutMs)
        })
    }
}