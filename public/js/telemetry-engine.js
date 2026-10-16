/**
 * ============================================================================
 * TELEMETRY ENGINE & RULE-BASED ENGINEERING ANALYTICS
 * Formula 1 IoT Telemetry & Race Simulator
 * ============================================================================
 * Handles:
 *  - 20Hz synchronous telemetry sampling and JSON packet formation
 *  - Rolling time-series buffers for real-time charts
 *  - Lap-by-lap telemetry recording & sector delta comparisons
 *  - Rule-based alert and diagnostic recommendation engine
 * ============================================================================
 */

class TelemetryEngine {
  constructor(vehiclePhysics, track) {
    this.physics = vehiclePhysics;
    this.track = track;
    this.config = window.F1_CONFIG;

    this.sampleRateHz = this.config.IOT.SAMPLE_RATE_HZ; // 20 Hz
    this.sampleIntervalMs = 1000 / this.sampleRateHz;   // 50 ms
    this.lastSampleTimeMs = 0;

    // Rolling Live Telemetry Buffer (for live graph rendering)
    this.maxBufferSize = 300;
    this.rollingBuffer = [];

    // Lap Archive (stores full telemetry traces for completed laps)
    this.lapArchives = {}; // { 1: [samples], 2: [samples] }
    this.currentLapSamples = [];
    this.referenceLapNumber = null;

    // Engineering Event & Alert Log
    this.eventLog = [];
    this.maxEventLogs = 100;
    this.activeAlerts = new Map(); // Key: alert ID, Value: alert object

    // Analysis State
    this.brakePointTurn1 = null;
    this.lastBrakingDistance = 0;
    this.lastEngineAlertTime = 0;
    this.lastTireAlertTime = 0;
    this.lastBrakeAlertTime = 0;
    this.lastSlipAlertTime = 0;
    this.lastTrackLimitTime = 0;
  }

  update(currentSessionTimeMs) {
    if (currentSessionTimeMs - this.lastSampleTimeMs < this.sampleIntervalMs) {
      return null; // Awaiting next sampling interval
    }

    this.lastSampleTimeMs = currentSessionTimeMs;

    // 1. Capture Raw Simulation Physics State into Telemetry Frame
    const packet = this.buildTelemetryPacket(currentSessionTimeMs);

    // 2. Append to Rolling Live Buffer
    this.rollingBuffer.push(packet);
    if (this.rollingBuffer.length > this.maxBufferSize) {
      this.rollingBuffer.shift();
    }

    // 3. Append to Current Lap Archive
    this.currentLapSamples.push(packet);

    // 4. Run Rule-Based Engineering Analysis Engine
    this.evaluateEngineeringRules(packet, currentSessionTimeMs);

    return packet;
  }

  buildTelemetryPacket(timestampMs) {
    const p = this.physics;
    const progress = p.trackProgress;

    // Delta vs best reference lap at current track distance
    const deltaSeconds = this.calculateDeltaAtDistance(progress.distance, p.currentLapTime);

    return {
      timestamp_ms: timestampMs,
      source: "simulation_physics_core",
      car_id: p.driver.id,
      driver_name: p.driver.name,
      team: p.driver.team,
      
      // Powertrain & Dynamics
      speed_kmh: Number(p.speedKmh.toFixed(1)),
      engine_rpm: Math.round(p.rpm),
      gear: p.gear,
      throttle_pct: Math.round(p.throttle * 100),
      brake_pct: Math.round(p.brake * 100),
      steering_angle_deg: Number(THREE.MathUtils.radToDeg(p.steerAngle).toFixed(2)),
      longitudinal_g: Number(p.longitudinalG.toFixed(2)),
      lateral_g: Number(p.lateralG.toFixed(2)),
      wheel_slip_pct: Number((p.wheelSlip * 100).toFixed(1)),
      drs_status: p.drsActive ? "OPEN" : "CLOSED",
      ers_soc_pct: Number((p.ersBatterySoc * 100).toFixed(1)),
      fuel_remaining_kg: Number(p.fuelRemaining_kg.toFixed(2)),

      // Thermal Subsystems
      engine_temp_c: Number(p.engineTemp_C.toFixed(1)),
      tires: {
        fl_temp_c: Number(p.tires.fl.temp.toFixed(1)),
        fr_temp_c: Number(p.tires.fr.temp.toFixed(1)),
        rl_temp_c: Number(p.tires.rl.temp.toFixed(1)),
        rr_temp_c: Number(p.tires.rr.temp.toFixed(1)),
        avg_wear_pct: Number(((p.tires.fl.wear + p.tires.fr.wear + p.tires.rl.wear + p.tires.rr.wear) / 4).toFixed(1))
      },
      brakes: {
        fl_temp_c: Math.round(p.brakes.fl.temp),
        fr_temp_c: Math.round(p.brakes.fr.temp),
        rl_temp_c: Math.round(p.brakes.rl.temp),
        rr_temp_c: Math.round(p.brakes.rr.temp)
      },

      // Race Timing & GPS
      lap_number: p.lapCount,
      lap_time_s: Number(p.currentLapTime.toFixed(3)),
      last_lap_time_s: Number(p.lastLapTime.toFixed(3)),
      best_lap_time_s: Number(p.bestLapTime.toFixed(3)),
      delta_s: Number(deltaSeconds.toFixed(3)),
      current_sector: progress.sector,
      sector_1_time_s: Number(p.sector1Time.toFixed(3)),
      sector_2_time_s: Number(p.sector2Time.toFixed(3)),
      track_distance_m: Math.round(progress.distance),
      track_progress_pct: Number((progress.u * 100).toFixed(2)),
      lateral_offset_m: Number(progress.lateralOffset.toFixed(2)),
      is_off_track: progress.isOffTrack,
      is_on_kerb: progress.isOnKerb,
      world_pos: {
        x: Number(p.position.x.toFixed(1)),
        y: Number(p.position.y.toFixed(1)),
        z: Number(p.position.z.toFixed(1))
      },

      // Vehicle Status
      status: this.getOverallVehicleStatus(p)
    };
  }

  getOverallVehicleStatus(p) {
    if (p.engineTemp_C > this.config.THRESHOLDS.ENGINE_TEMP.CRITICAL_C ||
        p.brakes.fl.temp > this.config.THRESHOLDS.BRAKE_TEMP.HOT_CRIT_C) {
      return "CRITICAL";
    }
    if (p.engineTemp_C > this.config.THRESHOLDS.ENGINE_TEMP.WARNING_C ||
        p.tires.fl.temp > this.config.THRESHOLDS.TIRE_TEMP.HOT_WARN_C ||
        p.tires.fr.temp > this.config.THRESHOLDS.TIRE_TEMP.HOT_WARN_C ||
        p.wheelSlip > this.config.THRESHOLDS.WHEEL_SLIP.TRACTION_ALERT) {
      return "WARNING";
    }
    return "NORMAL";
  }

  // Calculate live delta (+/- seconds) against reference lap at the same track distance
  calculateDeltaAtDistance(currentDistance, currentLapTime) {
    if (!this.referenceLapNumber || !this.lapArchives[this.referenceLapNumber]) {
      return 0.0;
    }

    const refSamples = this.lapArchives[this.referenceLapNumber];
    // Find closest sample in reference lap by track distance
    let closestRef = refSamples[0];
    let minDiff = Infinity;
    for (let i = 0; i < refSamples.length; i++) {
      const diff = Math.abs(refSamples[i].track_distance_m - currentDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closestRef = refSamples[i];
      }
    }

    if (closestRef) {
      // Positive = slower than reference, Negative = faster (green)
      return currentLapTime - closestRef.lap_time_s;
    }
    return 0.0;
  }

  // Lap Completion Hook
  onLapComplete(lapNumber) {
    if (this.currentLapSamples.length > 0) {
      this.lapArchives[lapNumber] = [...this.currentLapSamples];
      
      // If no reference lap or if this is the fastest, set as reference
      if (!this.referenceLapNumber || this.physics.lastLapTime <= this.physics.bestLapTime) {
        this.referenceLapNumber = lapNumber;
      }
      this.currentLapSamples = [];

      this.logEvent(
        "SUCCESS",
        "TIMING",
        `Lap ${lapNumber} completed: ${this.physics.lastLapTime.toFixed(3)}s. Sector times: S1: ${this.physics.sector1Time.toFixed(3)}s, S2: ${this.physics.sector2Time.toFixed(3)}s.`
      );
    }
  }

  // Rule-Based Engineering Analysis Logic
  evaluateEngineeringRules(packet, timestampMs) {
    const t = this.config.THRESHOLDS;

    // Rule 1: Engine Coolant Temperature Analysis
    if (packet.engine_temp_c >= t.ENGINE_TEMP.CRITICAL_C) {
      if (timestampMs - this.lastEngineAlertTime > 6000) {
        this.lastEngineAlertTime = timestampMs;
        this.logEvent("CRITICAL", "POWERTRAIN", `${t.ENGINE_TEMP.MESSAGE_CRIT} (Measured: ${packet.engine_temp_c}°C)`);
      }
    } else if (packet.engine_temp_c >= t.ENGINE_TEMP.WARNING_C) {
      if (timestampMs - this.lastEngineAlertTime > 8000) {
        this.lastEngineAlertTime = timestampMs;
        this.logEvent("WARNING", "POWERTRAIN", `${t.ENGINE_TEMP.MESSAGE_WARN} (Measured: ${packet.engine_temp_c}°C, Threshold: ${t.ENGINE_TEMP.WARNING_C}°C). Action: Move out of dirty wake / slipstream.`);
      }
    }

    // Rule 2: Tire Thermal Degradation & Blistering
    const maxTireTemp = Math.max(packet.tires.fl_temp_c, packet.tires.fr_temp_c, packet.tires.rl_temp_c, packet.tires.rr_temp_c);
    if (maxTireTemp > t.TIRE_TEMP.HOT_WARN_C) {
      if (timestampMs - this.lastTireAlertTime > 8000) {
        this.lastTireAlertTime = timestampMs;
        const hottestTire = packet.tires.fl_temp_c === maxTireTemp ? "FL" :
                            packet.tires.fr_temp_c === maxTireTemp ? "FR" :
                            packet.tires.rl_temp_c === maxTireTemp ? "RL" : "RR";
        this.logEvent("WARNING", "TIRES", `${t.TIRE_TEMP.MESSAGE_HOT} Max tire: ${hottestTire} @ ${maxTireTemp}°C. Action: Avoid aggressive curb impact.`);
      }
    }

    // Rule 3: Brake Disc Rotor Thermal Peak
    const maxBrakeTemp = Math.max(packet.brakes.fl_temp_c, packet.brakes.fr_temp_c);
    if (maxBrakeTemp > t.BRAKE_TEMP.HOT_WARN_C) {
      if (timestampMs - this.lastBrakeAlertTime > 8000) {
        this.lastBrakeAlertTime = timestampMs;
        this.logEvent("WARNING", "BRAKES", `${t.BRAKE_TEMP.MESSAGE_WARN} Peak rotor: ${maxBrakeTemp}°C. Action: Shift brake bias rearward.`);
      }
    }

    // Rule 4: Traction / Wheel Slip Detection
    if (packet.wheel_slip_pct > (t.WHEEL_SLIP.TRACTION_ALERT * 100)) {
      if (timestampMs - this.lastSlipAlertTime > 5000) {
        this.lastSlipAlertTime = timestampMs;
        this.logEvent("INFO", "DYNAMICS", `${t.WHEEL_SLIP.MESSAGE} Wheel slip: ${packet.wheel_slip_pct}%.`);
      }
    }

    // Rule 5: Turn 1 Braking Point Telemetry Logging
    // Chicane entry begins at distance ~650m-720m
    if (packet.track_distance_m >= 650 && packet.track_distance_m <= 750 && packet.brake_pct > 60) {
      if (!this.brakePointTurn1) {
        this.brakePointTurn1 = packet.track_distance_m;
        this.logEvent("INFO", "TELEMETRY", `Turn 1 Braking initiated at ${this.brakePointTurn1}m (Speed: ${packet.speed_kmh} km/h, Decel: ${packet.longitudinal_g}G).`);
      }
    } else if (packet.track_distance_m > 800) {
      this.brakePointTurn1 = null; // Reset for next lap
    }

    // Rule 6: Track Limits Enforcement
    if (packet.is_off_track) {
      if (timestampMs - this.lastTrackLimitTime > 5000) {
        this.lastTrackLimitTime = timestampMs;
        this.logEvent("WARNING", "STEWARD", `Track Limits Exceeded in Sector ${packet.current_sector} (Offset: ${packet.lateral_offset_m}m). Grip reduction active.`);
      }
    }
  }

  logEvent(severity, subsystem, message) {
    const timeStr = new Date().toTimeString().split(' ')[0] + '.' + Math.floor((Date.now() % 1000) / 100);
    const event = {
      id: Date.now() + Math.random(),
      time: timeStr,
      timestamp_ms: Date.now(),
      severity: severity, // 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS'
      subsystem: subsystem, // 'POWERTRAIN' | 'TIRES' | 'BRAKES' | 'TIMING' | 'STEWARD'
      message: message
    };

    this.eventLog.unshift(event);
    if (this.eventLog.length > this.maxEventLogs) {
      this.eventLog.pop();
    }

    // Also trigger audio beep if critical
    if (severity === 'CRITICAL' && window.f1Audio) {
      window.f1Audio.playPitRadioAlert();
    }
  }
}

window.TelemetryEngine = TelemetryEngine;
