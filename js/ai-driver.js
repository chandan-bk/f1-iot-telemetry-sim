/**
 * ============================================================================
 * AI OPPONENT DRIVING CONTROLLER & TRAJECTORY TRACKING
 * Formula 1 IoT Telemetry & Race Simulator
 * ============================================================================
 */

class AIDriverController {
  constructor(vehiclePhysics, driverConfig, track) {
    this.physics = vehiclePhysics;
    this.driver = driverConfig;
    this.track = track;
    this.profile = driverConfig.aiProfile;

    // AI Control Parameters
    this.lookAheadDistance_m = 32.0;
    this.targetSpeedKmh = 280.0;
    this.lateralOffset = 0.0; // Racing line offset
  }

  update(dt, playerCarPhysics, otherAICarPhysics) {
    const curDist = this.physics.trackProgress.distance;
    const trackLen = this.track.trackLength;
    const lookAheadDist = (curDist + this.lookAheadDistance_m) % trackLen;
    const lookAheadU = lookAheadDist / trackLen;

    // 1. Calculate Target Point & Racing Line
    const targetPoint = this.track.curve.getPointAt(lookAheadU);
    const targetTangent = this.track.curve.getTangentAt(lookAheadU);
    
    // Calculate curvature / target speed profile for upcoming section
    const cornerSpeedLimit = this.calculateTargetSpeed(lookAheadDist);
    this.targetSpeedKmh = cornerSpeedLimit * this.profile.cornerSpeedFactor;

    // 2. Lateral Steering Guidance towards spline centerline with collision avoidance
    const toTarget = targetPoint.clone().sub(this.physics.position);
    const targetAngle = Math.atan2(toTarget.x, toTarget.z);
    
    let angleDiff = targetAngle - this.physics.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Collision avoidance with player or other AI
    let avoidanceSteer = 0;
    [playerCarPhysics, otherAICarPhysics].forEach(other => {
      if (!other) return;
      const distToOther = this.physics.position.distanceTo(other.position);
      if (distToOther < 8.0) {
        // Too close: apply lateral avoidance
        const toOther = other.position.clone().sub(this.physics.position);
        const dotRight = Math.cos(this.physics.heading) * toOther.x - Math.sin(this.physics.heading) * toOther.z;
        avoidanceSteer = dotRight > 0 ? -0.4 : 0.4;
      }
    });

    const steerInput = THREE.MathUtils.clamp((angleDiff * 2.2) + avoidanceSteer, -1.0, 1.0);

    // 3. Longitudinal Speed Control (Throttle vs Braking)
    const currentSpeedKmh = this.physics.speedKmh;
    let throttleInput = 0;
    let brakeInput = 0;

    if (currentSpeedKmh < this.targetSpeedKmh - 5) {
      // Accelerate
      throttleInput = 1.0;
      brakeInput = 0;
    } else if (currentSpeedKmh > this.targetSpeedKmh + 8) {
      // Heavy Braking
      throttleInput = 0;
      const speedError = currentSpeedKmh - this.targetSpeedKmh;
      brakeInput = Math.min(1.0, (speedError / 35.0) * this.profile.brakingConsistency);
    } else {
      // Partial throttle maintenance
      throttleInput = 0.45;
      brakeInput = 0;
    }

    // DRS on main straight
    const isDrs = lookAheadDist >= this.track.config.drsZone.startDistance &&
                  lookAheadDist <= this.track.config.drsZone.endDistance;

    // Feed inputs into VehiclePhysics
    this.physics.update(dt, {
      throttle: throttleInput,
      brake: brakeInput,
      steering: steerInput,
      drs: isDrs
    });
  }

  // Predefined corner speed profile along track distance
  calculateTargetSpeed(dist) {
    // Sector 1: Main Straight (0-600m -> 320 km/h) -> Turn 1 & 2 Chicane (680-820m -> 125 km/h)
    if (dist < 640) return 325.0; // Straight
    if (dist >= 640 && dist < 820) return 115.0; // Heavy braking chicane
    
    // Sector 2: Esses (820-1350m -> 210-240 km/h high speed curves)
    if (dist >= 820 && dist < 1200) return 220.0;
    if (dist >= 1200 && dist < 1550) return 305.0; // Back straight

    // Sector 3: Hairpin (1550-1850m -> 85 km/h sharp hairpin)
    if (dist >= 1550 && dist < 1820) return 88.0; // Hairpin apex
    if (dist >= 1820 && dist < 2100) return 230.0; // Sweeper
    if (dist >= 2100 && dist < 2350) return 120.0; // Final chicane

    return 260.0;
  }
}

window.AIDriverController = AIDriverController;
