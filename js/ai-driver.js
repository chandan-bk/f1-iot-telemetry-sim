/**
 * ============================================================================
 * AI OPPONENT & AUTONOMOUS DRIVING CONTROLLER (MULTI-CAR RACING INTELLIGENCE)
 * Formula 1 IoT Telemetry & Race Simulator
 * ============================================================================
 * Features:
 *  - Dynamic trajectory tracking with variable lookahead distance
 *  - Multi-car collision avoidance, slipstreaming & overtaking lane choice
 *  - Curvature-based speed profiling with driver personality traits
 *  - Realistic trail-braking, gear shift management & DRS deployment
 * ============================================================================
 */

class AIDriverController {
  constructor(vehiclePhysics, driverConfig, track) {
    this.physics = vehiclePhysics;
    this.driver = driverConfig;
    this.track = track;
    this.profile = driverConfig.aiProfile || {
      aggression: 0.85,
      brakingConsistency: 0.95,
      cornerSpeedFactor: 1.0,
      mistakeProbability: 0.01
    };

    // AI Control Parameters
    this.lookAheadDistance_m = 32.0;
    this.targetSpeedKmh = 280.0;
    // Driver-specific natural lateral line bias (-1.8m to +1.8m)
    this.racingLineBias = (Math.random() - 0.5) * 2.2;
    this.overtakeOffset = 0.0;
    this.overtakeTimer = 0.0;
  }

  update(dt, ...otherCarsArgs) {
    const curDist = this.physics.trackProgress.distance;
    const trackLen = this.track.trackLength;
    const lookAheadDist = (curDist + this.lookAheadDistance_m) % trackLen;
    const lookAheadU = lookAheadDist / trackLen;

    // 1. Calculate Target Point & Base Racing Line with Lateral Bias
    const targetPoint = this.track.curve.getPointAt(lookAheadU);
    const targetTangent = this.track.curve.getTangentAt(lookAheadU);
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(targetTangent, up).normalize();

    // Corner speed profile along track distance
    const cornerSpeedLimit = this.calculateTargetSpeed(lookAheadDist);
    this.targetSpeedKmh = cornerSpeedLimit * this.profile.cornerSpeedFactor;

    // Flatten other cars list
    const otherCars = [];
    otherCarsArgs.forEach(arg => {
      if (Array.isArray(arg)) {
        arg.forEach(c => { if (c) otherCars.push(c.physics || c); });
      } else if (arg) {
        otherCars.push(arg.physics || arg);
      }
    });

    // 2. Multi-Car Proximity, Slipstream & Overtaking Evaluation
    let avoidanceSteer = 0;
    let slipstreamBoost = false;

    otherCars.forEach(other => {
      if (!other || other === this.physics) return;
      const toOther = other.position.clone().sub(this.physics.position);
      const dist = toOther.length();

      // Longitude check: is other car ahead of us?
      const forwardX = Math.sin(this.physics.heading);
      const forwardZ = Math.cos(this.physics.heading);
      const dotForward = forwardX * toOther.x + forwardZ * toOther.z;
      const dotRight = forwardZ * toOther.x - forwardX * toOther.z;

      // Close Proximity Avoidance (< 9.0m)
      if (dist < 9.5) {
        const sideSign = dotRight >= 0 ? -1 : 1;
        const urgency = (9.5 - dist) / 9.5;
        avoidanceSteer += sideSign * (0.35 + (urgency * 0.45));

        // If car directly in front is much slower, moderate speed
        if (dotForward > 0 && Math.abs(dotRight) < 2.5 && other.speedKmh < this.physics.speedKmh) {
          this.targetSpeedKmh = Math.min(this.targetSpeedKmh, other.speedKmh + 2.0);
        }
      } 
      // Slipstream & Overtaking Setup (9m to 25m directly ahead on straight)
      else if (dist < 26.0 && dotForward > 0 && Math.abs(dotRight) < 3.2 && this.physics.speedKmh > 210) {
        slipstreamBoost = true;
        // Trigger lateral maneuver to overtake
        if (this.overtakeTimer <= 0) {
          this.overtakeOffset = dotRight >= 0 ? -3.0 : 3.0;
          this.overtakeTimer = 3.5; // Hold overtake line for 3.5 seconds
        }
      }
    });

    if (this.overtakeTimer > 0) {
      this.overtakeTimer -= dt;
      if (this.overtakeTimer <= 0) this.overtakeOffset = 0;
    }

    // Apply lateral offset to target position
    const totalOffset = this.racingLineBias + this.overtakeOffset;
    const finalTargetPoint = targetPoint.clone().add(normal.clone().multiplyScalar(totalOffset));

    // Calculate heading error towards target
    const toTarget = finalTargetPoint.sub(this.physics.position);
    const targetAngle = Math.atan2(toTarget.x, toTarget.z);

    let angleDiff = targetAngle - this.physics.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const steerInput = THREE.MathUtils.clamp((angleDiff * 2.3) + avoidanceSteer, -1.0, 1.0);

    // 3. Longitudinal Speed Control (Throttle vs Braking)
    const currentSpeedKmh = this.physics.speedKmh;
    let throttleInput = 0;
    let brakeInput = 0;

    const targetWithSlipstream = slipstreamBoost ? this.targetSpeedKmh + 10.0 : this.targetSpeedKmh;

    if (currentSpeedKmh < targetWithSlipstream - 4) {
      // Full Acceleration
      throttleInput = 1.0;
      brakeInput = 0;
    } else if (currentSpeedKmh > targetWithSlipstream + 6) {
      // Deceleration / Trail Braking
      throttleInput = 0;
      const speedError = currentSpeedKmh - targetWithSlipstream;
      brakeInput = Math.min(1.0, (speedError / 30.0) * this.profile.brakingConsistency);
    } else {
      // Partial throttle maintenance
      throttleInput = 0.50;
      brakeInput = 0;
    }

    // DRS in straightaway zone
    const isDrs = lookAheadDist >= this.track.config.drsZone.startDistance &&
                  lookAheadDist <= this.track.config.drsZone.endDistance &&
                  brakeInput < 0.05;

    // Feed controls directly into VehiclePhysics
    this.physics.update(dt, {
      throttle: throttleInput,
      brake: brakeInput,
      steering: steerInput,
      drs: isDrs
    });
  }

  // Curvature speed limits around the 2.35 km circuit
  calculateTargetSpeed(dist) {
    // Sector 1: Main Straight (0-600m -> 325 km/h) -> Turn 1 & 2 Chicane (640-820m -> 118 km/h)
    if (dist < 630) return 328.0;
    if (dist >= 630 && dist < 820) return 118.0;

    // Sector 2: Esses (820-1200m -> 220 km/h) -> Back Straight (1200-1550m -> 310 km/h)
    if (dist >= 820 && dist < 1200) return 225.0;
    if (dist >= 1200 && dist < 1550) return 312.0;

    // Sector 3: Hairpin (1550-1820m -> 92 km/h) -> Fast Sweeper (1820-2100m -> 232 km/h) -> Final Chicane (2100-2350m -> 122 km/h)
    if (dist >= 1550 && dist < 1820) return 92.0;
    if (dist >= 1820 && dist < 2100) return 234.0;
    if (dist >= 2100 && dist < 2350) return 122.0;

    return 265.0;
  }
}

window.AIDriverController = AIDriverController;
