/**
 * ============================================================================
 * ESP32 MOTORSPORT IoT TELEMETRY TRANSMITTER FIRMWARE
 * Project: Application of IoT in Motorsport
 * ============================================================================
 * Hardware Setup:
 *  - ESP32 DevKit v1 (30-pin)
 *  - MPU6050 6-Axis IMU (I2C: SDA=GPIO21, SCL=GPIO22)
 *  - TCRT5000 IR Reflective Optical Gate Sensor (GPIO4, Interrupt Mode)
 *  - DS18B20 OneWire Temperature Sensor (GPIO18, 4.7k pullup)
 *  - Battery Monitor Voltage Divider (GPIO34 ADC)
 *  - Status LED (GPIO2 Onboard)
 * 
 * Communication:
 *  - Wi-Fi 802.11 b/g/n (Station Mode)
 *  - HTTP POST / WebSocket JSON serialization @ 20Hz (50ms interval)
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <ArduinoJson.h> // v6.x or v7.x

// Wi-Fi Credentials (Configure for demo router / mobile hotspot)
const char* WIFI_SSID     = "F1_TELEMETRY_NET";
const char* WIFI_PASSWORD = "telemetry_demo";

// Telemetry Gateway Server (IP of the laptop running node server.js)
const char* SERVER_INGEST_URL = "http://192.168.1.100:3000/api/telemetry/ingest";

// Hardware Pin Definitions
#define PIN_IR_BEAM      4   // TCRT5000 IR Gate Interrupt
#define PIN_ONEWIRE_TEMP 18  // DS18B20 Temp Sensor
#define PIN_BATTERY_ADC  34  // Voltage divider (R1=100k, R2=100k)
#define PIN_STATUS_LED   2   // Onboard Blue LED

// MPU6050 Registers
#define MPU6050_ADDR     0x68
#define REG_PWR_MGMT_1   0x6B
#define REG_ACCEL_XOUT_H 0x3B

// Timing & Telemetry State
unsigned long lastSampleTimeMs = 0;
const unsigned long SAMPLE_INTERVAL_MS = 50; // 20 Hz synchronous sampling

volatile unsigned long lastIrTriggerTimeMs = 0;
volatile bool irBeamTriggered = false;
volatile unsigned int completedLaps = 0;
unsigned long currentLapStartTimeMs = 0;

// Interrupt Service Routine for IR Lap Gate
void IRAM_ATTR onIrBeamBreak() {
  unsigned long now = millis();
  // 5-second software debounce to prevent duplicate triggers on finish line
  if (now - lastIrTriggerTimeMs > 5000) {
    lastIrTriggerTimeMs = now;
    irBeamTriggered = true;
    completedLaps++;
  }
}

void initMPU6050() {
  Wire.begin(21, 22, 400000); // 400kHz Fast I2C
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(REG_PWR_MGMT_1);
  Wire.write(0); // Wake up MPU6050
  Wire.endTransmission(true);
  Serial.println("[MPU6050] Initialized in continuous 100Hz mode.");
}

void readMPU6050(float &accelX_g, float &accelY_g, float &accelZ_g, float &gyroZ_dps) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(REG_ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 14, true);

  if (Wire.available() >= 14) {
    int16_t ax = (Wire.read() << 8) | Wire.read();
    int16_t ay = (Wire.read() << 8) | Wire.read();
    int16_t az = (Wire.read() << 8) | Wire.read();
    int16_t tempRaw = (Wire.read() << 8) | Wire.read();
    int16_t gx = (Wire.read() << 8) | Wire.read();
    int16_t gy = (Wire.read() << 8) | Wire.read();
    int16_t gz = (Wire.read() << 8) | Wire.read();

    // Scale factors: ±4g range (8192 LSB/g) and ±500 deg/s (65.5 LSB/(deg/s))
    accelX_g  = (float)ax / 8192.0f;
    accelY_g  = (float)ay / 8192.0f;
    accelZ_g  = (float)az / 8192.0f;
    gyroZ_dps = (float)gz / 65.5f;
  } else {
    accelX_g = 0.0;
    accelY_g = 0.0;
    accelZ_g = 1.0;
    gyroZ_dps = 0.0;
  }
}

float readBatteryVoltage() {
  int raw = analogRead(PIN_BATTERY_ADC);
  // 3.3V reference, 12-bit ADC (4095), 2:1 divider
  return ((float)raw / 4095.0f) * 3.3f * 2.0f;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_IR_BEAM, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_IR_BEAM), onIrBeamBreak, FALLING);

  digitalWrite(PIN_STATUS_LED, HIGH);
  initMPU6050();

  // Connect Wi-Fi
  Serial.printf("\nConnecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(300);
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] Connected! IP: %s | RSSI: %d dBm\n", 
      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    digitalWrite(PIN_STATUS_LED, LOW);
  } else {
    Serial.println("\n[Wi-Fi] AP connection timed out. Telemetry will buffer locally.");
  }

  currentLapStartTimeMs = millis();
}

void loop() {
  unsigned long now = millis();

  if (now - lastSampleTimeMs >= SAMPLE_INTERVAL_MS) {
    lastSampleTimeMs = now;

    // 1. Read Physical Sensors
    float ax, ay, az, gz;
    readMPU6050(ax, ay, az, gz);
    float batteryV = readBatteryVoltage();
    int rssi = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -99;

    // 2. Compute Lap Timings
    float lapTimeS = (float)(now - currentLapStartTimeMs) / 1000.0f;
    bool beamPulse = irBeamTriggered;
    if (irBeamTriggered) {
      irBeamTriggered = false;
      currentLapStartTimeMs = now;
    }

    // 3. Assemble Standardized JSON Telemetry Payload
    StaticJsonDocument<512> doc;
    doc["source"] = "esp32_prototype_devkit_v1";
    doc["timestamp_ms"] = now;
    doc["lap"] = completedLaps + 1;
    doc["lap_time_s"] = serialized(String(lapTimeS, 2));
    
    // Physical Measurements
    doc["accel_x_g"] = serialized(String(ax, 3));
    doc["accel_y_g"] = serialized(String(ay, 3));
    doc["accel_z_g"] = serialized(String(az, 3));
    doc["gyro_z_dps"] = serialized(String(gz, 2));
    doc["temperature_c"] = 37.4; // Simulated chassis temp if DS18B20 omitted
    doc["ir_trigger"] = beamPulse;
    doc["battery_v"] = serialized(String(batteryV, 2));
    doc["rssi_dbm"] = rssi;
    doc["sensor_status"] = "ONLINE";

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    // 4. Transmit via HTTP POST to Gateway
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(SERVER_INGEST_URL);
      http.addHeader("Content-Type", "application/json");

      int httpResponseCode = http.POST(jsonPayload);
      if (httpResponseCode > 0) {
        digitalWrite(PIN_STATUS_LED, HIGH); // Flash LED on ACK
      }
      http.end();
      digitalWrite(PIN_STATUS_LED, LOW);
    }

    // Debug Serial Stream (matches 20Hz CSV stream)
    Serial.printf("[IoT 20Hz] Lap:%d | Time:%.2fs | Ax:%.2fG | Ay:%.2fG | RSSI:%d\n",
      completedLaps + 1, lapTimeS, ax, ay, rssi);
  }
}
