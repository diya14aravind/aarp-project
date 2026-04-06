#include <Wire.h>
#include <SoftwareSerial.h>
#include <TinyGPS++.h>
#include <DHT.h>

// PIN CONFIGURATION (Aligned with Bio-Stasis/Guardian Sync)
#define GPS_RX_PIN 5
#define GPS_TX_PIN 6
#define DHTPIN 3
#define DHTTYPE DHT11
#define PULSE_PIN A0
#define BUZZER_PIN 8 // Optional alert buzzer

SoftwareSerial ss(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastUpdate = 0;
const int updateInterval = 1000; // 1 second updates

void setup() {
  Serial.begin(115200); // High speed for JSON streaming
  ss.begin(9600);       // Standard GPS baud rate
  dht.begin();
  
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // AXP192 or other power management initialization if needed for specific boards
  // For basic Uno, just start.
}

void loop() {
  // Feed GPS data
  while (ss.available() > 0) {
    gps.encode(ss.read());
  }

  // Periodic Telemetry
  if (millis() - lastUpdate >= updateInterval) {
    lastUpdate = millis();
    sendTelemetry();
  }
}

void sendTelemetry() {
  // Read Heartbeat (Simple mapping of analog signal for demonstration)
  // Real BPM calculation would require peak detection, but for now we'll 
  // provide a stable reading based on input.
  int rawPulse = analogRead(PULSE_PIN);
  int bpm = map(rawPulse, 400, 1023, 60, 160);
  bpm = constrain(bpm, 0, 220); // 0 if no pulse detected

  // Read Humidity & Temp
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  
  // Default values if sensor fails
  if (isnan(humidity)) humidity = 0.0;
  if (isnan(temperature)) temperature = 0.0;

  // GPS Data
  float lat = gps.location.isValid() ? gps.location.lat() : 0.0;
  float lng = gps.location.isValid() ? gps.location.lng() : 0.0;
  float speed = gps.speed.kmph();
  int satellites = gps.satellites.value();

  // Print JSON to Serial
  Serial.print("{");
  Serial.print("\"bpm\":"); Serial.print(bpm);
  Serial.print(",\"temp\":"); Serial.print(temperature);
  Serial.print(",\"hum\":"); Serial.print(humidity);
  Serial.print(",\"lat\":"); Serial.print(lat, 6);
  Serial.print(",\"lng\":"); Serial.print(lng, 6);
  Serial.print(",\"spd\":"); Serial.print(speed);
  Serial.print(",\"sats\":"); Serial.print(satellites);
  Serial.print(",\"ts\":"); Serial.print(millis());
  Serial.println("}");
}
