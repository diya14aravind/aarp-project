#include <Wire.h>
#include <SoftwareSerial.h>
#include <TinyGPS++.h>
#include <DHT.h>
#include <MPU6050_light.h>

// PIN CONFIGURATION
#define DHTPIN 3
#define DHTTYPE DHT11
#define PULSE_PIN A0
#define BUZZER_PIN 8
#define GPS_RX 5
#define GPS_TX 6

SoftwareSerial ss(GPS_RX, GPS_TX);
TinyGPSPlus gps;
DHT dht(DHTPIN, DHTTYPE);
MPU6050 mpu(Wire);

unsigned long lastSend = 0;
int lastBpm = 0;
bool fallFlag = false;

void setup() {
  Serial.begin(115200);
  ss.begin(9600);
  Wire.begin();
  dht.begin();
  
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  byte status = mpu.begin();
  if (status == 0) {
    delay(1000);
    mpu.calcOffsets(true, true); // initial calibration
  }

  Serial.println("{\"status\":\"READY\"}");
}

void checkFall() {
  // Update IMU
  mpu.update();

  // Simple magnitude check for impact
  float mag = sqrt(pow(mpu.getAccX(), 2) + pow(mpu.getAccY(), 2) + pow(mpu.getAccZ(), 2));
  
  // If sudden acceleration spike followed by tilting
  if (mag > 2.5 && !fallFlag) {
    delay(500); // Wait 0.5s to see if user stays down
    mpu.update();
    if (abs(mpu.getAngleX()) > 45 || abs(mpu.getAngleY()) > 45) {
       fallFlag = true;
    }
  }
}

void loop() {
  // 1. Listen for Acknowledgment Commands from Website Bridge
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'R') { // Reset / Acknowledge Alarm
      fallFlag = false;
      digitalWrite(BUZZER_PIN, LOW);
    }
  }

  // 2. Feed GPS Data
  while (ss.available() > 0) {
    gps.encode(ss.read());
  }

  // 3. Fall Detection Update
  checkFall();

  // 4. Periodic Telemetry Send (Every 1 Second)
  if (millis() - lastSend > 1000) {
    lastSend = millis();
    sendData();
  }
}

void sendData() {
  // Read Humidity & Temp
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h)) h = 0.0;
  if (isnan(t)) t = 0.0;

  // Heartbeat Logic (Simple Smoothing)
  int raw = analogRead(PULSE_PIN);
  int bpm = map(raw, 400, 1023, 60, 160);
  bpm = constrain(bpm, 0, 220);
  // Smoothing
  lastBpm = (lastBpm * 0.7) + (bpm * 0.3);

  // GPS Data
  double lat = gps.location.isValid() ? gps.location.lat() : 12.9716;
  double lng = gps.location.isValid() ? gps.location.lng() : 79.1559;

  // ALARM LOGIC (Fall or Dangerous Heartbeat)
  bool isEmergency = false;
  if (fallFlag || lastBpm > 150 || (lastBpm > 0 && lastBpm < 40)) {
    isEmergency = true;
    digitalWrite(BUZZER_PIN, HIGH); // Sound local alarm
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  // Output JSON for the Bridge
  Serial.print("{");
  Serial.print("\"bpm\":"); Serial.print(lastBpm);
  Serial.print(",\"temp\":"); Serial.print(t);
  Serial.print(",\"hum\":"); Serial.print(h);
  Serial.print(",\"lat\":"); Serial.print(lat, 6);
  Serial.print(",\"lng\":"); Serial.print(lng, 6);
  Serial.print(",\"sats\":"); Serial.print(gps.satellites.value());
  Serial.print(",\"fall\":"); Serial.print(fallFlag ? "true" : "false");
  Serial.print(",\"emergency\":"); Serial.print(isEmergency ? "true" : "false");
  Serial.println("}");
}
