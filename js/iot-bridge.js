/**
 * ============================================================================
 * IoT HARDWARE BRIDGE & INGESTION PIPELINE (MODE 1 & MODE 2)
 * Formula 1 IoT Telemetry & Race Simulator
 * ============================================================================
 * Supports:
 *  - Mode 1: Pure Virtual Simulation Ingest
 *  - Mode 2: ESP32 Hardware IoT Prototype (WebSocket / HTTP Ingest)
 *  - Virtual ESP32 Hardware Test Bench & Sensor Emulator (for lab demos)
 *  - Sensor classification tags: [PHYSICAL SENSOR], [DERIVED], [SIMULATION ONLY]
 * ============================================================================
 */

class IoTTelemetryBridge {
  constructor() {
    this.mode = 'SIMULATION'; // 'SIMULATION' or 'HARDWARE_ESP32'
    this.ws = null;
    this.isConnected = false;
    this.packetCount = 0;
    this.lastPacketTime = 0;
    this.currentHz = 0;
    this.pingMs = 0;
    
    // Hardware Prototype Telemetry Cache
    this.latestHardwarePacket = null;
    this.hardwareSource = "ESP32-WROOM-32D (MAC: 24:6F:28:B4:12:8A)";
    this.wifiRssi = -58; // dBm
    this.batteryVoltage = 3.82; // V

    // Simulated Hardware Test Bench generator
    this.simulatedHardwareInterval = null;
    this.hardwareTestBenchActive = false;

    // Listeners
    this.onPacketReceivedCallbacks = [];

    // Attempt auto-connecting to Node WebSocket server
    this.initWebSocket();
  }

  setMode(newMode) {
    this.mode = newMode;
    console.log(`[IoT Bridge] Operating mode switched to: ${newMode}`);

    if (newMode === 'HARDWARE_ESP32') {
      if (!this.isConnected && !this.hardwareTestBenchActive) {
        // Start testbench fallback so demo doesn't fail if physical ESP32 is offline
        this.startHardwareTestBench();
      }
    } else {
      this.stopHardwareTestBench();
    }
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = window.location.port || '3000';
    const wsUrl = `${protocol}//${host}:${port}/telemetry-stream`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log(`[IoT Bridge] Connected to telemetry WebSocket server at ${wsUrl}`);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TELEMETRY_UPDATE' || msg.type === 'TELEMETRY_SYNC') {
            this.handleIncomingHardwarePacket(msg.data);
          } else if (msg.type === 'PONG') {
            this.pingMs = Date.now() - msg.timestamp;
          }
        } catch (err) {
          console.error('[IoT Bridge] Message parse error:', err);
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        // Retry connection in 3 seconds
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      this.isConnected = false;
    }
  }

  sendVirtualTelemetry(packet) {
    // If connected to Node server, stream simulation telemetry upstream
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'TELEMETRY_INGEST',
        source: 'simulation_webgl_client',
        data: packet
      }));
    }

    // Measure packet rate
    this.updateStats();
  }

  handleIncomingHardwarePacket(rawPacket) {
    this.packetCount++;
    this.updateStats();

    // Map ESP32 payload to standardized telemetry format with clear metadata classifications
    const standardizedPacket = {
      timestamp_ms: rawPacket.timestamp_ms || Date.now(),
      source: rawPacket.source || "esp32_prototype",
      hardware_meta: {
        is_hardware_source: true,
        device: this.hardwareSource,
        rssi_dbm: rawPacket.rssi_dbm || this.wifiRssi,
        battery_v: rawPacket.battery_v || this.batteryVoltage,
        sensor_status: rawPacket.sensor_status || "ONLINE"
      },

      // PHYSICAL SENSOR READINGS (Direct from ESP32 GPIO/I2C/OneWire)
      physical_sensors: {
        accel_x_g: { value: rawPacket.accel_x_g || 0, tag: "[PHYSICAL: MPU6050]" },
        accel_y_g: { value: rawPacket.accel_y_g || 0, tag: "[PHYSICAL: MPU6050]" },
        accel_z_g: { value: rawPacket.accel_z_g || 1.0, tag: "[PHYSICAL: MPU6050]" },
        gyro_z_dps: { value: rawPacket.gyro_z_dps || 0, tag: "[PHYSICAL: MPU6050 Gyro]" },
        chassis_temp_c: { value: rawPacket.temperature_c || 36.4, tag: "[PHYSICAL: DS18B20]" },
        ir_gate_trigger: { value: !!rawPacket.ir_trigger, tag: "[PHYSICAL: TCRT5000 IR]" }
      },

      // DERIVED FROM PHYSICAL SENSORS (Integrations & filters)
      derived_metrics: {
        speed_kmh: { value: rawPacket.speed_kmh || 0, tag: "[DERIVED: Accel Integration]" },
        lap_time_s: { value: rawPacket.lap_time_s || 0, tag: "[DERIVED: IR Beam Timer]" },
        longitudinal_g: { value: rawPacket.accel_y_g || 0, tag: "[DERIVED: Filtered Accel]" },
        lateral_g: { value: rawPacket.accel_x_g || 0, tag: "[DERIVED: Filtered Accel]" }
      },

      // SIMULATION-ONLY PARAMETERS (Not measured by hardware prototype)
      simulated_metrics: {
        engine_rpm: { value: rawPacket.engine_rpm || 11500, tag: "[SIMULATION ONLY: No Hall Sensor]" },
        gear: { value: rawPacket.gear || 4, tag: "[SIMULATION ONLY: ECU Proxy]" },
        tire_temps: { value: "N/A on physical prototype", tag: "[SIMULATION ONLY: Requires IR Pyrometers]" },
        downforce_n: { value: "N/A on physical prototype", tag: "[SIMULATION ONLY: Wind Tunnel Model]" }
      }
    };

    this.latestHardwarePacket = standardizedPacket;

    // Trigger subscribers
    this.onPacketReceivedCallbacks.forEach(cb => cb(standardizedPacket));
  }

  // Built-in ESP32 Hardware Simulator / Test Bench
  // Emulates an actual ESP32 sending MPU6050 accelerometer & IR lap triggers over Wi-Fi
  startHardwareTestBench() {
    if (this.hardwareTestBenchActive) return;
    this.hardwareTestBenchActive = true;
    console.log("[IoT Bridge] Started ESP32 Hardware Prototype Emulator (Test Bench Mode)");

    let simTime = 0;
    let lapCount = 1;
    let lapTimer = 0;

    this.simulatedHardwareInterval = setInterval(() => {
      simTime += 0.05;
      lapTimer += 0.05;

      // Simulate realistic MPU6050 noise and harmonic vibrations
      const noise = (Math.random() - 0.5) * 0.04;
      const corneringPhase = Math.sin(simTime * 0.8);
      const accelX = Number((corneringPhase * 1.8 + noise).toFixed(3));
      const accelY = Number((Math.cos(simTime * 0.5) * 0.8 + noise).toFixed(3));
      const gyroZ = Number((corneringPhase * 45.0 + (Math.random() - 0.5) * 2.0).toFixed(2));
      const speed = Number((160 + (Math.sin(simTime * 0.4) * 90) + (Math.random() * 2)).toFixed(1));
      const temp = Number((34.2 + (Math.sin(simTime * 0.05) * 4.5)).toFixed(1));

      // Trigger IR optical gate beam every ~72 seconds
      let irTrigger = false;
      if (lapTimer > 72.0) {
        irTrigger = true;
        lapTimer = 0;
        lapCount++;
      }

      const mockEsp32Payload = {
        source: "esp32_prototype_devkit_v1",
        mac_address: "24:6F:28:B4:12:8A",
        timestamp_ms: Date.now(),
        lap: lapCount,
        lap_time_s: Number(lapTimer.toFixed(2)),
        speed_kmh: speed,
        accel_x_g: accelX,
        accel_y_g: accelY,
        accel_z_g: 0.98,
        gyro_z_dps: gyroZ,
        temperature_c: temp,
        ir_trigger: irTrigger,
        battery_v: Number((3.82 - (simTime * 0.0001)).toFixed(2)),
        rssi_dbm: Math.floor(-56 + (Math.random() * 6 - 3)),
        sensor_status: "ONLINE"
      };

      this.handleIncomingHardwarePacket(mockEsp32Payload);
    }, 50); // 20 Hz
  }

  stopHardwareTestBench() {
    if (this.simulatedHardwareInterval) {
      clearInterval(this.simulatedHardwareInterval);
      this.simulatedHardwareInterval = null;
    }
    this.hardwareTestBenchActive = false;
  }

  updateStats() {
    const now = Date.now();
    if (this.lastPacketTime > 0) {
      const delta = now - this.lastPacketTime;
      if (delta > 0) {
        const instantHz = 1000 / delta;
        this.currentHz = Math.round((this.currentHz * 0.8) + (instantHz * 0.2));
      }
    }
    this.lastPacketTime = now;
  }

  subscribe(callback) {
    this.onPacketReceivedCallbacks.push(callback);
  }
}

window.IoTTelemetryBridge = IoTTelemetryBridge;
