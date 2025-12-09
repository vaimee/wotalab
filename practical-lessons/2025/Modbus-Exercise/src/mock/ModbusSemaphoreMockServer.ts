const ModbusRTU = require("modbus-serial");

// Stato interno del semaforo
let semaphoreState = 0; // 0=red,1=yellow,2=green

const vector = {
    getHoldingRegister: function(addr:any, unitID:any, callback:any) {
        if (addr === 0) {
            // restituisci il valore corrente
            console.log(`(ModbusSemaphore) Returning semaphore state: ${semaphoreState}`)
            callback(null, semaphoreState);
        } else {
            callback(null, 0); // default
        }
    },
    setRegister: function(addr:any, value:any, unitID:any) {
        if (addr === 0 && value >=0 && value <= 2) {
            semaphoreState = value;
            console.log(`(ModbusSemaphore) Updated semaphore state: ${value} (0=red,1=yellow,2=green)`);
        }
    }
};

const serverTCP = new ModbusRTU.ServerTCP(vector, { host: "0.0.0.0", port: 8502, debug: true, unitID: 1 });

serverTCP.on("socketError", function(err:any){
    console.error(err);
});

console.log("Mock Modbus Semaphore running on modbus://0.0.0.0:8502");
