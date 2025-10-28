#define LED_BLUE 51
#define LED_GREEN 53
#define LED_RED 52
#define LAMP 47
String status="off"; //lamp state (on/off)
bool isConnected=false; //true if device is connected to laptop


void setup() {
  pinMode(LED_BLUE,OUTPUT);
  pinMode(LED_GREEN,OUTPUT);
  pinMode(LED_RED,OUTPUT);
  pinMode(LAMP,OUTPUT);
  digitalWrite(LED_BLUE,HIGH);

  Serial.begin(9600);
  Serial.setTimeout(10); // Set timeout to 10 ms
}

/*
Serial controls
$ping -> return pong
$status -> read status
$toggle -> toggle on/off
*/
void loop() {
  if(Serial.available()){
    String data= Serial.readString();
    String command= parse(data);
    //Serial.println("$command received: "+command);
    if(command.equals("status")){ //Handle status read
      Serial.println("$"+status);
    }else if(command.equals("toggle")){ //Handle toggle
      if(status.equals("off")){
        status="on";
        digitalWrite(LAMP,HIGH);
      }else{
        status="off";
        digitalWrite(LAMP,LOW);
      }
      Serial.println("$"+status);      
    }else if(command.equals("ping")){ //Handle explore
      Serial.println("$pong");
      if(!isConnected){
        isConnected=true;
        digitalWrite(LED_BLUE,LOW);
        digitalWrite(LED_GREEN,HIGH);
        digitalWrite(LED_RED,LOW);
      }
    }else if(command.equals("hello")){
      Serial.println("$Hello! I am an arduino lamp controller!");
    }else{
      Serial.println("$unknown command: "+command);
    }
  }
  delay(50);
}


String parse(String data){ //remove $ and \r\n from the incoming serial string
  return data.substring(1,data.length()-2);
}