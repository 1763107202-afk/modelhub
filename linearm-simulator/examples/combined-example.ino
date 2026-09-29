// 融合示例：保留两份动作代码，首个全黑标记之后停下执行一次机械臂序列。
// 这是可编辑的示例调度：并非在实物上已验证的比赛策略。
// 原循迹 loop 的 delay(500) 结束后才执行下面的机械臂触发判断。
// 机械臂运行时，不会执行下一轮循迹判断。
#define ENA 2
#define IN1 4
#define IN2 16
#define ENB 17
#define IN3 5
#define IN4 18
#define ENC 19
#define IN5 21
#define IN6 22
#define END 23
#define IN7 12
#define IN8 13
#define S1 33
#define S2 32
#define S3 35
#define S4 34

void setMotor(int motor, int speed, bool forward) {
  if (motor == 1) {
    analogWrite(ENA, speed);
    digitalWrite(IN1, forward ? HIGH : LOW);
    digitalWrite(IN2, forward ? LOW : HIGH);
  }
  else if (motor == 2) {
    analogWrite(ENB, speed);
    digitalWrite(IN3, forward ? HIGH : LOW);
    digitalWrite(IN4, forward ? LOW : HIGH);
  }
  else if (motor == 3) {
    analogWrite(ENC, speed);
    digitalWrite(IN5, forward ? HIGH : LOW);
    digitalWrite(IN6, forward ? LOW : HIGH);
  }
  else if (motor == 4) {
    analogWrite(END, speed);
    digitalWrite(IN7, forward ? HIGH : LOW);
    digitalWrite(IN8, forward ? LOW : HIGH);
  }
}
void stopMotor(int motor) {
  if (motor == 1) {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 0);
  }
  else if (motor == 2) {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, LOW);
    analogWrite(ENB, 0);
  }
  else if (motor == 3) {
    digitalWrite(IN5, LOW);
    digitalWrite(IN6, LOW);
    analogWrite(ENC, 0);
  }
  else if (motor == 4) {
    digitalWrite(IN7, LOW);
    digitalWrite(IN8, LOW);
    analogWrite(END, 0);
  }
}
void setupDrive() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENC, OUTPUT);
  pinMode(IN5, OUTPUT);
  pinMode(IN6, OUTPUT);
  pinMode(END, OUTPUT);
  pinMode(IN7, OUTPUT);
  pinMode(IN8, OUTPUT);
}
int i=0;
void loopDrive() {
  int s1=digitalRead(S1); // 黑线为高电平 1
  int s2=digitalRead(S2);
  int s3=digitalRead(S3);
  int s4=digitalRead(S4);
  if(s1==0 && s2==1 && s3==1 && s4==0) {
    setMotor(1,160,true);
    setMotor(2,160,true);
    setMotor(3,160,true);
    setMotor(4,160,true);
  }
  else if(s1==0 && s2==0 && s3==1 && s4==0) {
    setMotor(1,160,true);
    setMotor(2,160,true);
    setMotor(3,160,true);
    setMotor(4,160,true);
  }
  else if(s1==0 && s2==1 && s3==0 && s4==0) {
    setMotor(1,160,true);
    setMotor(2,160,true);
    setMotor(3,160,true);
    setMotor(4,160,true);
  }
  else if(s1==1 && s2==0 && s3==0 && s4==0) {
    setMotor(1,160,true);
    setMotor(2,160,true);
    setMotor(3,160,true);
    setMotor(4,160,true);
  }
  else if(s1==0 && s2==0 && s3==1 && s4==1) {
    setMotor(1,160,true);
    setMotor(2,160,true);
    setMotor(3,0,true);
    setMotor(4,0,true);
  }
  else if(s1==0 && s2==0 && s3==0 && s4==1) {
    setMotor(1,160,true);
    setMotor(2,160,true);
    setMotor(3,0,true);
    setMotor(4,0,true);
  }
  else if(s1==0 && s2==0 && s3==0 && s4==0) {
    setMotor(1,160,true);
    setMotor(2,160,true);
    setMotor(3,0,true);
    setMotor(4,0,true);
  }
  else if(s1==1 && s2==1 && s3==1 && s4==1) {
    i++;
    if(i==1 || i==3 || i==4) {
      stopMotor(1);
      stopMotor(2);
      stopMotor(3);
      stopMotor(4);
      delay(100);
      setMotor(1,130,true);
      setMotor(2,130,true);
      setMotor(3,130,true);
      setMotor(4,130,true);
      delay(500);
    }
    else {
      setMotor(1,130,true);
      setMotor(2,130,true);
      setMotor(3,130,true);
      setMotor(4,130,true);
      delay(500);
    }
  }
}

#include <ESP32Servo.h>
Servo left;
Servo right;
Servo zhua;
Servo zhuan;
void setupArm() {
  zhuan.attach(14);
  zhua.attach(27);
  left.attach(26);
  right.attach(25);
}
void runArm() {
  for (int p=140; p<=155; p++) { zhua.write(p); }
  delay(1000);
  for (int p=100; p>=90; p--) { left.write(p); }
  delay(1000);
  for (int p=110; p>=32; p--) { zhuan.write(p); }
  delay(1000);
  delay(2000);
  for (int p=85; p<=125; p++) { right.write(p); }
  delay(1000);
  delay(2000);
  for (int p=155; p>=140; p--) { zhua.write(p); }
  delay(1000);
  delay(2000);
  for (int p=125; p>=85; p--) { right.write(p); }
  delay(1000);
  for (int p=32; p<=140; p++) { zhuan.write(p); }
  delay(1000);
  for (int p=140; p<=155; p++) { zhua.write(p); }
  delay(1000);
  for (int p=85; p>=70; p--) { right.write(p); }
  delay(1000);
  for (int p=145; p>=18; p--) { zhuan.write(p); }
  delay(1000);
  for (int p=100; p>=90; p--) { left.write(p); }
  delay(1000);
  for (int p=70; p<=125; p++) { right.write(p); }
  delay(1000);
  for (int p=155; p>=140; p--) { zhua.write(p); }
  delay(1000);
  for (int p=125; p>=85; p--) { right.write(p); }
  delay(1000);
  for (int p=18; p<=115; p++) { zhuan.write(p); }
  delay(1000);
  for (int p=140; p<=155; p++) { zhua.write(p); }
  delay(1000);
  for (int p=85; p>=70; p--) { right.write(p); }
  delay(1000);
  for (int p=115; p>=22; p--) { zhuan.write(p); }
  delay(1000);
  for (int p=100; p>=90; p--) { left.write(p); }
  delay(1000);
  for (int p=70; p<=135; p++) { right.write(p); }
  delay(1000);
  for (int p=90; p<=120; p++) { left.write(p); }
  delay(1000);
  for (int p=155; p>=140; p--) { zhua.write(p); }
  delay(1000);
  delay(10000);
  for (int p=140; p<=155; p++) { zhua.write(p); }
  delay(1000);
  for (int p=120; p>=80; p--) { left.write(p); }
  delay(1000);
  for (int p=135; p>=60; p--) { right.write(p); }
  delay(1000);
  for (int p=22; p<=115; p++) { zhuan.write(p); }
  delay(1000);
  for (int p=60; p<=110; p++) { right.write(p); }
  delay(1000);
  for (int p=155; p>=140; p--) { zhua.write(p); }
  delay(1000);
  for (int p=110; p>=85; p--) { right.write(p); }
  delay(1000);
  for (int p=115; p>=38; p--) { zhuan.write(p); }
  delay(1000);
  for (int p=85; p<=120; p++) { right.write(p); }
  delay(1000);
  for (int p=80; p<=120; p++) { left.write(p); }
  delay(1000);
  for (int p=140; p<=155; p++) { zhua.write(p); }
  delay(1000);
  for (int p=120; p>=80; p--) { left.write(p); }
  delay(1000);
  for (int p=135; p>=60; p--) { right.write(p); }
  delay(1000);
  for (int p=38; p<=140; p++) { zhuan.write(p); }
  delay(1000);
  for (int p=60; p<=110; p++) { right.write(p); }
  delay(1000);
  for (int p=155; p>=140; p--) { zhua.write(p); }
  delay(1000);
  for (int p=110; p>=85; p--) { right.write(p); }
  delay(1000);
  for (int p=140; p>=53; p--) { zhuan.write(p); }
  delay(1000);
  for (int p=85; p<=120; p++) { right.write(p); }
  delay(1000);
  for (int p=80; p<=120; p++) { left.write(p); }
  delay(1000);
  for (int p=140; p<=155; p++) { zhua.write(p); }
  for (int p=120; p>=80; p--) { left.write(p); }
  delay(1000);
  delay(10000);
}

bool armDone = false;
void setup() {
  setupDrive();
  setupArm();
}
void loop() {
  loopDrive();
  if (i >= 1 && !armDone) {
    stopMotor(1);
    stopMotor(2);
    stopMotor(3);
    stopMotor(4);
    armDone = true;
    runArm();
  }
}
