#include <ESP32Servo.h>
Servo left;
Servo right;
Servo zhua;
Servo zhuan;
void setup() {
  zhuan.attach(14);
  zhua.attach(27);
  left.attach(26);
  right.attach(25);
}
void loop() {
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
