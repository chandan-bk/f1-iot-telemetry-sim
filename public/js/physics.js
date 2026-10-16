/**
 * ============================================================================
 * FORMULA 1 VEHICLE PHYSICS DYNAMICS ENGINE
 * ============================================================================
 * Implements:
 *  - 1.6L V6 Turbocharged Hybrid Powertrain with 8-speed sequential transmission
 *  - Ground-effect aerodynamic downforce & speed-squared aerodynamic drag
 *  - Pacejka-inspired multi-surface tire friction model (asphalt, kerb, grass)
 *  - 4-Wheel individual tire thermal and wear degradation dynamics
 *  - Carbon-carbon brake disc heating & convective cooling model
 *  - Engine thermal dynamics (radiator heat rejection vs combustion heat)
 *  - ERS hybrid battery energy recovery (MGU-K) & deployment
 *  - Longitudinal & lateral G-force calculation
 * ============================================================================
 */

class VehiclePhysics {
  constructor(carModel, track, driverConfig) {
    this.carModel = carModel;
    this.track = track;
    this.driver = driverConfig;
    this.cfg = window.F1_CONFIG.VEHICLE;

    // Kinematic State
    this.position = new THREE.Vector3(0, 0.2, -390);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.speed = 0;              // Forward speed in m/s
    this.speedKmh = 0;           // Forward speed in km/h
    this.heading = 0;            // Yaw angle in radians
    this.steerAngle = 0;        // Front wheel steering angle (rad)
    this.angularVelocity = 0;    // Yaw rate (rad/s)

    // Accelerations & G-forces
    this.longitudinalAcc = 0;    // m/s^2 (+ accel, - braking)
    this.lateralAcc = 0;         // m/s^2 (+ right, - left)
    this.longitudinalG = 0;      // G-force
    this.lateralG = 0;           // G-force

    // Powertrain State
    this.throttle = 0;           // 0.0 to 1.0
    this.brake = 0;              // 0.0 to 1.0
    this.handbrake = false;
    this.drsActive = false;
    this.gear = 1;               // 1 to 8
    this.rpm = this.cfg.idleRpm;
    this.wheelSpeed = 0;         // Driven wheel rotational speed in m/s
    this.wheelSlip = 0;          // Wheel slip ratio (0.0 to 1.0)
    this.shiftTimer = 0;

    // Thermal & Degradation State
    this.engineTemp_C = this.cfg.engineNormalTemp_C;
    this.fuelRemaining_kg = 105.0; // Starting fuel load
    this.ersBatterySoc = 0.85;     // 85% battery charge (0.0 - 1.0)
    
    // 4-Wheel Subsystems: Front-Left, Front-Right, Rear-Left, Rear-Right
    this.tires = {
      fl: { temp: 88.0, wear: 0.0, pressure_psi: 22.5, slipAngle: 0 },
      fr: { temp: 88.0, wear: 0.0, pressure_psi: 22.5, slipAngle: 0 },
      rl: { temp: 92.0, wear: 0.0, pressure_psi: 20.5, slipAngle: 0 },
      rr: { temp: 92.0, wear: 0.0, pressure_psi: 20.5, slipAngle: 0 }
    };

    this.brakes = {
      fl: { temp: 320.0 }, // Operating temp in °C
      fr: { temp: 320.0 },
      rl: { temp: 280.0 },
      rr: { temp: 280.0 }
    };

    // Lap & Track Progress State
    this.trackProgress = {
      distance: 0,
      u: 0,
      lateralOffset: 0,
      isOffTrack: false,
      isOnKerb: false,
      sector: 1
    };

    this.lapCount = 1;
    this.lapStartTime = 0;
    this.currentLapTime = 0;
    this.sectorTimes = [0, 0, 0];
    this.sector1Time = 0;
    this.sector2Time = 0;
    this.sector3Time = 0;
    this.lastLapTime = 0;
    this.bestLapTime = 0;
    this.completedLaps = [];
    this.lastCrossedDistance = 0;
    this.crossedFinishCooldown = 0;

    // Track Limits Enforcement & Physical Barrier Collision State
    this.trackLimitsViolations = 0;
    this.lapInvalidated = false;
    this.trackLimitWarningTimer = 0;
    this.barrierImpactTimer = 0;
    this.hasBarrierImpact = false;
    this.wasOffTrack = false;

    // Reset to starting grid position
    this.resetToGrid(0);
  }

  resetToGrid(gridSlotIndex = 0) {
    const gridDist = -18 - (gridSlotIndex * 12);
    const gridU = (gridDist + this.track.trackLength) % this.track.trackLength / this.track.trackLength;
    const pt = this.track.curve.getPointAt(gridU);
    const tangent = this.track.curve.getTangentAt(gridU);
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const lateralOffset = (gridSlotIndex % 2 === 0) ? -2.8 : 2.8;

    this.position.copy(pt).add(normal.multiplyScalar(lateralOffset));
    this.position.y = pt.y + 0.15;
    this.heading = Math.atan2(tangent.x, tangent.z);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.speedKmh = 0;
    this.rpm = this.cfg.idleRpm;
    this.gear = 1;
    this.steerAngle = 0;
    this.angularVelocity = 0;
    this.longitudinalG = 0;
    this.lateralG = 0;
    this.wheelSlip = 0;
    this.drsActive = false;
    this.crossedFinishCooldown = 3.0; // Prevent instant trigger on spawn

    if (this.carModel && this.carModel.root) {
      this.carModel.root.position.copy(this.position);
      this.carModel.root.rotation.set(0, this.heading, 0);
    }
  }

  update(dt, input) {
    if (dt <= 0 || dt > 0.1) dt = 0.016; // Safeguard against background tab lag

    // 1. Process Driver Inputs
    this.throttle = THREE.MathUtils.clamp(input.throttle || 0, 0, 1);
    this.brake = THREE.MathUtils.clamp(input.brake || 0, 0, 1);
    this.handbrake = !!input.handbrake;

    // Speed-sensitive steering ratio: decreases at high speed to maintain high-speed stability
    const maxSteerRad = THREE.MathUtils.degToRad(22.0); // 22 degrees max lock at parking speed
    const speedFactor = 1.0 / (1.0 + (this.speed * 0.028));
    const targetSteer = (input.steering || 0) * maxSteerRad * speedFactor;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, dt * 14.0);

    // DRS Zone Evaluation
    const inDrsZone = this.trackProgress.distance >= this.track.config.drsZone.startDistance &&
                      this.trackProgress.distance <= this.track.config.drsZone.endDistance;
    this.drsActive = inDrsZone && (input.drs || this.throttle > 0.85) && (this.brake < 0.1);

    // 2. Track Surface Query & Off-track Grip Evaluation
    this.trackProgress = this.track.getTrackProgress(this.position);
    const halfWidth = this.track.config.width_m / 2;
    const lateralDist = Math.abs(this.trackProgress.lateralOffset);

    // Dynamic Surface Grip Transitions:
    // 0 to 7.0m: Clean dry racing asphalt (Peak grip 1.72)
    // 7.0m to 8.45m: Rumble kerbs (Grip 1.28)
    // 8.45m to 13.5m: Paul Ricard Blue Runoff (Grip 1.18, abrasive tire wear)
    // > 13.5m: Red Runoff / Gravel trap (Grip 0.45, heavy deceleration drag)
    let surfaceGrip = this.cfg.tireGripPeakCoeff;
    if (lateralDist <= halfWidth) {
      surfaceGrip = this.cfg.tireGripPeakCoeff;
    } else if (lateralDist <= halfWidth + 1.45) {
      surfaceGrip = this.cfg.tireGripKerbCoeff;
    } else if (lateralDist <= halfWidth + 6.5) {
      surfaceGrip = 1.18;
      // Accelerated tire scrubbing in high-friction runoff
      this.tires.fl.wear += dt * 0.005;
      this.tires.fr.wear += dt * 0.005;
    } else {
      surfaceGrip = 0.45;
      // Heavy deceleration resistance from gravel/grass
      this.speed = Math.max(0, this.speed - (dt * 14.0));
      this.tires.fl.wear += dt * 0.012;
      this.tires.fr.wear += dt * 0.012;
    }

    // 3. Aerodynamics: Downforce and Drag
    const v = this.speed;
    const v2 = v * v;
    const rho = this.cfg.airDensity_kg_m3;
    const area = this.cfg.frontalArea_m2;
    const cd = this.drsActive ? this.cfg.dragCoefficient_DRS : this.cfg.dragCoefficient_Cd;
    
    // Aerodynamic Drag Force (N): F_drag = 0.5 * rho * Cd * A * v^2
    const dragForce = 0.5 * rho * cd * area * v2;
    
    // Aerodynamic Downforce (N): F_down = 0.5 * rho * Cl * A * v^2
    const downforceNewtons = 0.5 * rho * this.cfg.downforceCoeff_Cl * area * v2;
    const totalNormalForce_N = (this.cfg.mass_kg * 9.81) + downforceNewtons;

    // 4. Powertrain & Gearbox Dynamics
    this.updatePowertrain(dt);

    // Tractive Engine Force at driven wheels
    const currentGearRatio = this.cfg.gearRatios[this.gear] || 1.0;
    const totalDriveRatio = currentGearRatio * this.cfg.finalDrive;
    const tireRadius = 0.36; // 360mm rolling radius
    
    // Hybrid Power Delivery: ICE Torque + ERS MGU-K Boost
    let ersBoostNm = 0;
    if (this.throttle > 0.8 && this.ersBatterySoc > 0.05) {
      ersBoostNm = 120; // 120 Nm electrical torque assist
      this.ersBatterySoc = Math.max(0, this.ersBatterySoc - (0.015 * dt));
    }

    const engineTorque = (this.cfg.peakTorqueNm * this.getTorqueCurve(this.rpm)) + ersBoostNm;
    let driveForce = 0;

    if (this.shiftTimer <= 0) {
      driveForce = (engineTorque * totalDriveRatio * this.throttle) / tireRadius;
    }

    // 5. Braking Dynamics & ERS Harvesting
    let brakeForce = 0;
    if (this.brake > 0) {
      // Carbon brakes decelerate with up to 50 m/s^2 (~5.1G) assisted by downforce
      const maxAvailableDecel = Math.min(this.cfg.maxBrakingDecel_ms2, (totalNormalForce_N * surfaceGrip) / this.cfg.mass_kg);
      brakeForce = this.brake * maxAvailableDecel * this.cfg.mass_kg;

      // ERS MGU-K Kinetic Energy Recovery under braking
      if (this.ersBatterySoc < 0.99 && this.speed > 8) {
        this.ersBatterySoc = Math.min(1.0, this.ersBatterySoc + (0.022 * dt));
      }
    }

    if (this.handbrake) {
      brakeForce += 15000;
    }

    // Rolling resistance
    const rollingResistance = 0.015 * this.cfg.mass_kg * 9.81;

    // Net Longitudinal Force
    const netLongitudinalForce = driveForce - brakeForce - dragForce - (rollingResistance * Math.sign(this.speed));
    this.longitudinalAcc = netLongitudinalForce / this.cfg.mass_kg;
    this.longitudinalG = this.longitudinalAcc / 9.81;

    // Integrate forward speed
    this.speed = Math.max(0, this.speed + (this.longitudinalAcc * dt));
    this.speedKmh = this.speed * 3.6;

    // Wheel Slip Calculation
    const idealWheelSpeed = this.speed;
    const theoreticalDriveSpeed = (this.rpm / totalDriveRatio / 60) * (2 * Math.PI * tireRadius);
    if (this.throttle > 0.5 && this.speed > 1) {
      this.wheelSlip = Math.max(0, (theoreticalDriveSpeed - idealWheelSpeed) / Math.max(1, idealWheelSpeed));
    } else {
      this.wheelSlip = Math.max(0, this.wheelSlip - (dt * 2.0));
    }

    // 6. Lateral Dynamics & Cornering
    const maxLateralGripForce = totalNormalForce_N * surfaceGrip;
    const maxLateralAcc = maxLateralGripForce / this.cfg.mass_kg; // m/s^2

    // Ackermann yaw rate
    const targetYawRate = (this.speed / this.cfg.wheelbase_m) * Math.tan(this.steerAngle);
    
    // Progressive cornering slip / understeer limit
    const demandedLateralAcc = Math.abs(this.speed * targetYawRate);
    let corneringEfficiency = 1.0;
    if (demandedLateralAcc > maxLateralAcc) {
      corneringEfficiency = maxLateralAcc / demandedLateralAcc; // Front tire understeer scrub
    }

    this.angularVelocity = targetYawRate * corneringEfficiency;
    this.heading += this.angularVelocity * dt;

    this.lateralAcc = this.speed * this.angularVelocity;
    this.lateralG = this.lateralAcc / 9.81;

    // 7. Update 3D World Position & Enforce Physical Boundaries
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);

    this.velocity.set(forwardX * this.speed, 0, forwardZ * this.speed);
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    
    // Query post-step position relative to track centerline
    const postProgress = this.track.getTrackProgress(this.position);
    this.trackProgress = postProgress;
    const postLateralDist = Math.abs(postProgress.lateralOffset);
    const barrierLimit = halfWidth + 9.2; // Solid concrete safety barrier position

    // A. SOLID CONCRETE BARRIER COLLISION & ELASTIC DEFLECTION
    if (postLateralDist >= barrierLimit) {
      const sideSign = Math.sign(postProgress.lateralOffset);

      // Clamp position so vehicle cannot pass through the concrete barrier
      const clampedOffset = sideSign * (barrierLimit - 0.25);
      const offsetDiff = clampedOffset - postProgress.lateralOffset;
      this.position.add(postProgress.normal.clone().multiplyScalar(offsetDiff));

      // Rebound heading back toward the circuit centerline
      const trackTangentHeading = Math.atan2(postProgress.tangent.x, postProgress.tangent.z);
      let headingDelta = this.heading - trackTangentHeading;
      while (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
      while (headingDelta < -Math.PI) headingDelta += Math.PI * 2;

      if (sideSign > 0) {
        // Impact on right wall: deflect vehicle leftward
        this.heading = trackTangentHeading - Math.abs(headingDelta * 0.4) - 0.18;
      } else {
        // Impact on left wall: deflect vehicle rightward
        this.heading = trackTangentHeading + Math.abs(headingDelta * 0.4) + 0.18;
      }

      // 45% kinetic energy absorption in barrier crash
      this.speed *= 0.55;
      this.speedKmh = this.speed * 3.6;

      this.hasBarrierImpact = true;
      this.barrierImpactTimer = 0.8;
      this.lapInvalidated = true;
    } else {
      this.hasBarrierImpact = false;
    }

    // B. TRACK LIMITS VIOLATION ENFORCEMENT (White Boundary Ribbon)
    const isOverLimit = postLateralDist > (halfWidth + 0.85);
    if (isOverLimit) {
      if (!this.wasOffTrack && this.speedKmh > 35) {
        this.trackLimitsViolations++;
        this.lapInvalidated = true;
        this.trackLimitWarningTimer = 2.5; // Flash warning for 2.5s
      }
      this.wasOffTrack = true;
    } else {
      this.wasOffTrack = false;
    }

    // Track elevation tracking
    const trackPt = this.track.curve.getPointAt(this.trackProgress.u);
    this.position.y = trackPt.y + 0.15;

    // 8. Update Thermal, Brake and Tire Degradation Subsystems
    this.updateThermalSubsystems(dt);

    // 9. Lap Timing & Sector Progression
    this.updateLapTiming(dt);

    // 10. Sync 3D Car Model Visuals
    if (this.carModel) {
      this.carModel.root.position.copy(this.position);
      this.carModel.root.rotation.set(0, this.heading, 0);

      // Chassis roll and pitch under G-forces
      const rollAngle = -this.lateralG * 0.025; // Lean into corner
      const pitchAngle = this.longitudinalG * 0.018; // Squat on accel, dive on brake
      this.carModel.root.rotation.z = rollAngle;
      this.carModel.root.rotation.x = pitchAngle;

      this.carModel.updateVisuals(
        this.speed,
        this.steerAngle,
        this.brake > 0.05,
        this.drsActive,
        {
          fl: this.brakes.fl.temp,
          fr: this.brakes.fr.temp,
          rl: this.brakes.rl.temp,
          rr: this.brakes.rr.temp
        },
        this
      );
    }
  }

  updatePowertrain(dt) {
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      return;
    }

    const tireRadius = 0.36;
    const currentGearRatio = this.cfg.gearRatios[this.gear] || 1.0;
    const totalDriveRatio = currentGearRatio * this.cfg.finalDrive;

    // Calculate RPM matching driven axle speed
    const calculatedRpm = (this.speed / (2 * Math.PI * tireRadius)) * totalDriveRatio * 60;
    
    if (this.throttle > 0.05) {
      this.rpm = THREE.MathUtils.clamp(calculatedRpm, this.cfg.idleRpm, this.cfg.revLimiterRpm);
    } else {
      this.rpm = Math.max(this.cfg.idleRpm, this.rpm - (dt * 8000));
    }

    // Automatic Sequential Gear Shifting Logic
    if (this.gear < 8 && this.rpm > 13800 && this.throttle > 0.6) {
      // Upshift
      this.gear++;
      this.shiftTimer = this.cfg.shiftDelayMs / 1000;
      this.rpm = Math.max(this.cfg.idleRpm, this.rpm * 0.78);
    } else if (this.gear > 1 && (this.rpm < 7000 || (this.brake > 0.3 && this.rpm < 9500))) {
      // Downshift
      this.gear--;
      this.shiftTimer = this.cfg.shiftDelayMs / 1000;
      this.rpm = Math.min(this.cfg.revLimiterRpm, this.rpm * 1.25);
    }
  }

  getTorqueCurve(rpm) {
    // F1 1.6L V6 Turbo torque plateau: high broad torque from 7,000 to 14,000 RPM
    if (rpm < 5000) return 0.55;
    if (rpm < 8000) return 0.85;
    if (rpm < 13500) return 1.00; // Peak torque plateau
    return Math.max(0.6, 1.0 - ((rpm - 13500) / 2500) * 0.4);
  }

  updateThermalSubsystems(dt) {
    // 1. Engine Coolant Temperature Dynamics
    // Combustion heat: proportional to throttle, RPM load, and high speed
    const engineLoad = (this.throttle * 0.7) + ((this.rpm / this.cfg.maxRpm) * 0.3);
    const combustionHeat = engineLoad * 28.0; // °C heat flux
    // Radiator cooling: proportional to forward vehicle airspeed
    const radiatorCooling = (this.engineTemp_C - this.cfg.ambientTemp_C) * (0.04 + (this.speed * 0.0016));
    this.engineTemp_C += (combustionHeat - radiatorCooling) * (dt / 10.0);

    // 2. Carbon-Carbon Brake Disc Thermal Model
    ['fl', 'fr', 'rl', 'rr'].forEach(k => {
      const isFront = k.startsWith('f');
      const bias = isFront ? 0.58 : 0.42;

      // Heavy braking converts kinetic energy into thermal energy in rotors
      if (this.brake > 0.05 && this.speed > 2) {
        const brakeWork = this.brake * bias * (this.speed / 50.0) * 260.0;
        this.brakes[k].temp = Math.min(1150.0, this.brakes[k].temp + (brakeWork * dt));
      }

      // Convective cooling through carbon brake ducts
      const ambientCooling = (this.brakes[k].temp - this.cfg.ambientTemp_C) * (0.12 + (this.speed * 0.008));
      this.brakes[k].temp = Math.max(this.cfg.ambientTemp_C, this.brakes[k].temp - (ambientCooling * dt));
    });

    // 3. 4-Wheel Individual Tire Temperature & Wear Degradation
    ['fl', 'fr', 'rl', 'rr'].forEach(k => {
      const isLeft = k.endsWith('l');
      const isRear = k.startsWith('r');

      // Lateral scrub heating (right turns heat left tires, left turns heat right tires)
      const latLoad = Math.abs(this.lateralG) * ((this.lateralG > 0 && isLeft) || (this.lateralG < 0 && !isLeft) ? 1.6 : 0.8);
      // Longitudinal friction heating (rear tires heat under wheel spin, front under hard braking)
      const longLoad = isRear ? (this.wheelSlip * 35.0) : (this.brake * 12.0);

      const frictionWork = (latLoad * 6.5) + longLoad;
      const tireCooling = (this.tires[k].temp - this.cfg.ambientTemp_C) * (0.06 + (this.speed * 0.003));
      
      this.tires[k].temp += (frictionWork - tireCooling) * dt;

      // Progressive tire wear degradation accumulation
      const wearDelta = (dt * 0.003) * (1.0 + (latLoad * 2.0) + (this.wheelSlip * 8.0));
      this.tires[k].wear = Math.min(100.0, this.tires[k].wear + wearDelta);
    });

    // 4. Fuel Burn Integral (~1.6 kg / lap)
    const fuelRate_kg_s = 0.012 + (this.throttle * 0.024);
    this.fuelRemaining_kg = Math.max(0, this.fuelRemaining_kg - (fuelRate_kg_s * dt));
  }

  updateLapTiming(dt) {
    this.currentLapTime += dt;
    this.crossedFinishCooldown = Math.max(0, this.crossedFinishCooldown - dt);

    const dist = this.trackProgress.distance;
    const totalLen = this.track.trackLength;
    const currentSector = this.track.getSector(dist);
    this.trackProgress.sector = currentSector;

    // Track finish-line crossover (crossover from high distance > 85% of track to < 15%)
    if (this.lastCrossedDistance > (totalLen * 0.85) && dist < (totalLen * 0.15) && this.crossedFinishCooldown === 0) {
      // Completed Lap!
      this.lastLapTime = this.currentLapTime;
      const isLapClean = !this.lapInvalidated;

      if (isLapClean && (this.bestLapTime === 0 || this.currentLapTime < this.bestLapTime)) {
        this.bestLapTime = this.currentLapTime;
      }

      this.completedLaps.push({
        lap: this.lapCount,
        lapTime: this.currentLapTime,
        isValid: isLapClean,
        sector1: this.sector1Time,
        sector2: this.sector2Time,
        sector3: Math.max(0, this.currentLapTime - (this.sector1Time + this.sector2Time)),
        avgSpeedKmh: (totalLen / this.currentLapTime) * 3.6,
        tireWear: (this.tires.fl.wear + this.tires.fr.wear + this.tires.rl.wear + this.tires.rr.wear) / 4
      });

      this.lapCount++;
      this.currentLapTime = 0;
      this.sector1Time = 0;
      this.sector2Time = 0;
      this.sector3Time = 0;
      this.crossedFinishCooldown = 4.0; // Cooldown prevents multiple triggers
      this.lapInvalidated = false; // Reset clean slate for next lap!
    }

    // Sector Split Triggers
    if (currentSector === 2 && this.sector1Time === 0) {
      this.sector1Time = this.currentLapTime;
    } else if (currentSector === 3 && this.sector2Time === 0) {
      this.sector2Time = this.currentLapTime - this.sector1Time;
    }

    this.lastCrossedDistance = dist;
  }
}

window.VehiclePhysics = VehiclePhysics;
