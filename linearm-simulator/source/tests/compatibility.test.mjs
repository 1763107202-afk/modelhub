import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/sim/world.mjs';
import {compile} from '../lib/sim/interpreter.mjs';
function run(code,ms=1){const w=new Simulation();w.load(code);w.tick(ms);assert.equal(w.error,null,w.error?.message);return w;}
function failure(code,pattern){const w=new Simulation();try{w.load(code);w.tick(1);assert.match(w.error?.message??'',pattern);}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.match(e.message,pattern);}}
test('MOTOR struct array, member assignment, prototypes and dynamic motor indexing drive real outputs',()=>{
 const w=run(`
 #define ENA 2
 struct MOTOR { int In_1; int In_2; int EN; int dir; };
 MOTOR motor[4];
 void motor_init(); void setMotor(int,int); void stopMotor(int);
 void setup(){motor_init();}
 void loop(){for(int i=0;i<4;i++)setMotor(i,160);delay(1000);}
 void motor_init(){int pins[4][3]={{4,16,ENA},{5,18,17},{21,22,19},{12,13,23}};
 for(int i=0;i<4;i++){motor[i].In_1=pins[i][0];motor[i].In_2=pins[i][1];motor[i].EN=pins[i][2];motor[i].dir=1;
 pinMode(motor[i].In_1,OUTPUT);pinMode(motor[i].In_2,OUTPUT);pinMode(motor[i].EN,OUTPUT);}}
 void setMotor(int num,int speed){digitalWrite(motor[num].In_1,motor[num].dir);digitalWrite(motor[num].In_2,!motor[num].dir);analogWrite(motor[num].EN,speed);}
 void stopMotor(int num){analogWrite(motor[num].EN,0);}
 `,20);assert.deepEqual(w.motor,[160,160,160,160]);assert.ok(w.distance>0);assert.equal(w.vm.variables().motor[3].EN,23);
});
test('Nested aggregates, struct copy and pass by value remain independent; references modify original',()=>{
 const w=run(`typedef struct {int pin;float gain;} Joint;
 struct Robot {Joint joint;int samples[3];};
 Robot a={{2,.5},{3,4}},b;int answer;
 void byValue(Robot r){r.joint.pin=99;r.samples[0]=99;}
 void byReference(Robot &r){r.joint.pin++;r.samples[1]+=2;}
 void setup(){b=a;byValue(a);byReference(b);answer=b.samples[1]/2;}
 void loop(){delay(1000);}`);
 const {a,b,answer}=w.vm.variables();assert.equal(a.joint.pin,2);assert.deepEqual(a.samples,[3,4,0]);assert.equal(b.joint.pin,3);assert.deepEqual(b.samples,[3,6,0]);assert.equal(answer,3);
});
test('Static locals persist, enum/typedef/using and switch fallthrough implement a state machine',()=>{
 const w=run(`enum State {IDLE=2,GO,STOP}; typedef unsigned long Millis;using Counter=uint8_t;
 State state=IDLE;Counter calls=0;int total=0;Millis stamp=0;
 int next(){static int count=0;return ++count;}
 void setup(){} void loop(){calls=next();switch(calls){case 1:total+=1;case 2:total+=2;break;default:state=STOP;total+=4;}stamp=millis();delay(5);}`,19);
 const v=w.vm.variables();assert.equal(v.calls,4);assert.equal(v.total,13);assert.equal(v.state,4);assert.equal(v.stamp,18);
});
test('switch default position, break and continue respect the enclosing loop',()=>{
 const w=run('int count=0;void setup(){for(int i=0;i<4;i++){switch(i){default:count+=10;break;case 0:continue;case 1:count++;case 2:count+=2;break;}count++;}}void loop(){delay(1000);}');assert.equal(w.vm.variables().count,18);
});
test('Object and function macros, floating gains, literals and casts retain numeric meaning',()=>{
 const w=run(`#define SCALE(x) ((x)*GAIN)
 #define GAIN .5f
 #define MASK 0xFF
 float gain=GAIN;float value=SCALE(3);int bits=MASK & 0b1010;int letter='A';
 uint8_t byteValue=256;int integer=5/2;float quotient=5.0/2;
 void setup(){byteValue--;bits|=1;}void loop(){delay(1000);}`);
 const v=w.vm.variables();assert.equal(v.gain,.5);assert.equal(v.value,1.5);assert.equal(v.bits,11);assert.equal(v.letter,65);assert.equal(v.byteValue,255);assert.equal(v.integer,2);assert.equal(v.quotient,2.5);
});
test('Array parameters, default argument from prototype, comma expressions and sizeof',()=>{
 const w=run(`int values[]={1,2,3,4};int sum=0;int size=sizeof(values)/sizeof(values[0]);
 void add(int a[],int n,int offset=2);
 void setup(){add(values,size);for(int i=0,j=3;i<4;i++,j--)sum+=values[j];}
 void add(int a[],int n,int offset){for(int i=0;i<n;i++)a[i]+=offset;}
 void loop(){delay(1000);}`);
 assert.deepEqual(w.vm.variables().values,[3,4,5,6]);assert.equal(w.vm.variables().sum,18);assert.equal(w.vm.variables().size,4);
});
test('Nested initializer padding, independent struct array entries and Servo arrays',()=>{
 const w=run(`#include <ESP32Servo.h>
 struct Item{int n;};Item items[2]={{4}};Servo joints[2];int grid[2][2]={{1},{2,3}};
 void setup(){items[0].n=8;joints[0].attach(14);joints[1].attach(26);joints[0].write(35);joints[1].write(70);}
 void loop(){delay(1000);}`);assert.equal(w.vm.variables().items[1].n,0);assert.deepEqual(w.vm.variables().grid,[[1,0],[2,3]]);assert.deepEqual(w.targets.slice(0,2),[35,70]);
});
test('Integer division respects struct fields, function return types and fractional return values',()=>{
 const w=run('struct T{int n;float f;};T a={5,5.0};float x,y,z;int get(){return 5;}void setup(){x=a.n/2;y=a.f/2;z=get()/2;}void loop(){delay(1000);}');assert.deepEqual([w.vm.variables().x,w.vm.variables().y,w.vm.variables().z],[2,2.5,2]);
});
test('Macro errors preserve user line numbers and unsupported features fail explicitly',()=>{
 assert.throws(()=>compile('#define BAD missing\nvoid setup(){}\nvoid loop(){ BAD = ; }'),e=>e.line===3);
 failure('struct T{int n;};T a;void setup(){a.missing=3;}void loop(){}',/未定义结构体成员/);
 failure('int a[2];void setup(){a[2]=5;}void loop(){}',/越界/);
 failure('const int a[2]={1,2};void setup(){a[0]=3;}void loop(){}',/常量/);
 failure('struct T{int n;};const T a={1};void setup(){a.n=3;}void loop(){}',/常量/);
 failure('void setup(){break;}void loop(){}',/之外/);
 failure('int a[5000];void setup(){}void loop(){}',/数组长度/);
});
test('Reference and aggregate errors do not silently produce plausible output',()=>{
 failure('void f(int &a){a++;}void setup(){f(5);}void loop(){}',/左侧必须/);
 failure('const int a=1;void f(int &x){x++;}void setup(){f(a);}void loop(){}',/常量/);
 failure('struct A{int n;};struct B{int n;};A a;B b;void setup(){a=b;}void loop(){}',/类型不匹配/);
 failure('int a[2]={1,2,3};void setup(){}void loop(){}',/超出/);
 failure('int a[2];void setup(){a=3;}void loop(){}',/整个数组/);
});
test('Legacy ESP32 LEDC channel setup and 10-bit PWM control the configured motor',()=>{
 const w=run('void setup(){ledcSetup(0,5000,10);ledcAttachPin(2,0);digitalWrite(4,HIGH);digitalWrite(16,LOW);}void loop(){ledcWrite(0,512);delay(1000);}');assert.ok(Math.abs(w.motor[0]-512/1023*255)<1e-8);
});
test('Modern ESP32 LEDC pin/channel APIs share channel duty and detach correctly',()=>{
 const w=run('int duty;void setup(){ledcAttachChannel(2,5000,8,1);ledcAttachChannel(17,5000,8,1);digitalWrite(4,HIGH);digitalWrite(5,HIGH);ledcWrite(2,80);duty=ledcRead(17);}void loop(){ledcWriteChannel(1,160);delay(10);ledcDetach(2);delay(1000);}',11);
 assert.equal(w.vm.variables().duty,80);assert.deepEqual(w.motor.slice(0,2),[0,160]);
});
test('Analog resolution changes normalize duty; mixed LEDC generations give an actionable error',()=>{
 const w=run('void setup(){analogWriteResolution(2,10);digitalWrite(4,HIGH);analogWrite(2,1023);}void loop(){delay(1000);}');assert.equal(w.motor[0],255);
 failure('void setup(){ledcSetup(0,1000,8);ledcAttach(2,1000,8);}void loop(){}',/不能混用/);
});
test('Changed PWM pin produces a wiring warning and works after virtual rewiring',()=>{
 const code='void setup(){digitalWrite(4,HIGH);analogWrite(15,160);}void loop(){delay(1000);}';const w=run(code);assert.equal(w.motor[0],0);assert.ok(w.logs.some(x=>x.type==='warning'&&x.text.includes('GPIO 15')));
 const connected=new Simulation({motorPins:[[15,4,16],[17,5,18],[19,21,22],[23,12,13]]});connected.load(code);connected.tick(1);assert.equal(connected.motor[0],160);
});
test('Aggregate assignment, function macros and sizeof preserve C++ value semantics',()=>{
 const w=run(`#define DOUBLE(x) ((x)+(x))
 struct M{int n;float gain;};M a;M b;int index=0;int values[2][3]={{1,2,3},{4}};int size;
 void setup(){a=M{DOUBLE(3),.5};b=a;b.n++;size=sizeof(values[index++])/sizeof(int);}
 void loop(){delay(1000);}`);
 assert.equal(w.vm.variables().a.n,6);assert.equal(w.vm.variables().b.n,7);assert.equal(w.vm.variables().index,0);assert.equal(w.vm.variables().size,3);
});
test('Conditional macro guards and multiline macros expand without touching quoted text',()=>{
 const w=run('#ifndef PINS\n#define PINS\n#define PIN 2\n#endif\n#define SCALE(x) \\\n ((x)*2)\nint a=SCALE(PIN);String label="PIN";\n#ifdef PINS\nint enabled=1;\n#else\nint enabled=0;\n#endif\nvoid setup(){}void loop(){delay(1000);}');
 assert.equal(w.vm.variables().a,4);assert.equal(w.vm.variables().label,'PIN');assert.equal(w.vm.variables().enabled,1);
});
test('Serial formats binary inputs, floating telemetry, char buffers and printf fields',()=>{
 const w=run('float gain=.125;char text[]="OK";void setup(){Serial.println(255,HEX);Serial.println(gain,3);Serial.println(text);Serial.printf("s=%d, pwm=%03u, gain=%.2f\\n",digitalRead(32),7,gain);}void loop(){delay(1000);}');
 assert.deepEqual(w.logs.filter(x=>x.type==='serial').map(x=>x.text),['FF','0.125','OK','s=1, pwm=007, gain=0.13\n']);
});

test('Basic pointers, address-of, dereference and arrow member access work for common Arduino helpers',()=>{
 const w=run(`
 struct T{int n;};int x=3;T item={4};int result=0;
 void bump(int *p){(*p)++;}
 void setup(){int *p=&x;bump(p);T *q=&item;q->n+=2;result=x+item.n;}
 void loop(){delay(1000);}
 `);
 assert.equal(w.vm.variables().x,4);assert.equal(w.vm.variables().item.n,6);assert.equal(w.vm.variables().result,10);
});
test('Common conditional compilation, relaxed includes and full-width pasted punctuation compile',()=>{
 const w=run(`#include <SomeTeamMotorDriver.h>
 #define MODE 2
 #if MODE == 1
 int selected=1;
 #elif defined(MODE) && MODE == 2
 int selected=2;
 #else
 int selected=3;
 #endif
 int value=0;
 void setup（）｛ value＝selected＋3； ｝
 void loop（）｛ delay（1000）； ｝
 `);
 assert.equal(w.vm.variables().value,5);
});
test('Automatic wiring recognizes common two-motor and four-sensor sketches',()=>{
 const w=run(`
 #define PWMA 14
 #define AIN1 25
 #define AIN2 26
 #define PWMB 27
 #define BIN1 32
 #define BIN2 33
 #define S1 4
 #define S2 16
 #define S3 17
 #define S4 18
 void setup(){pinMode(AIN1,OUTPUT);pinMode(AIN2,OUTPUT);pinMode(BIN1,OUTPUT);pinMode(BIN2,OUTPUT);}
 void loop(){int a=digitalRead(S1);int b=digitalRead(S2);int c=digitalRead(S3);int d=digitalRead(S4);
 digitalWrite(AIN1,HIGH);digitalWrite(AIN2,LOW);digitalWrite(BIN1,HIGH);digitalWrite(BIN2,LOW);
 analogWrite(PWMA,120);analogWrite(PWMB,140);delay(1000);}
 `,10);
 assert.deepEqual(w.config.sensorPins,[4,16,17,18]);
 assert.deepEqual(w.config.motorPins,[[14,25,26],[14,25,26],[27,32,33],[27,32,33]]);
 assert.deepEqual(w.motor,[120,120,140,140]);
});
