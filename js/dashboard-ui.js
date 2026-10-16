/**
 * ============================================================================
 * RACE ENGINEER TELEMETRY DASHBOARD UI
 * Formula 1 IoT Telemetry & Race Simulator
 * ============================================================================
 * Implements:
 *  - Real-time digital gauges, bar meters, and tire thermal matrix
 *  - High-performance 60fps rolling Canvas charts (Speed, Throttle/Brake, RPM, Temps)
 *  - G-G Traction Circle Diagram
 *  - Live Leaderboard with sector splits and interval gaps
 *  - Live Event Log with severity badges
 *  - Rule-based Diagnostic Recommendations Panel
 * ============================================================================
 */

class DashboardUI {
  constructor(telemetryEngine, iotBridge, track) {
    this.engine = telemetryEngine;
    this.bridge = iotBridge;
    this.track = track;

    // Canvas Chart Elements
    this.chartSpeedCanvas = document.getElementById('chart-speed');
    this.chartPedalsCanvas = document.getElementById('chart-pedals');
    this.chartRpmCanvas = document.getElementById('chart-rpm');
    this.chartTempsCanvas = document.getElementById('chart-temps');
    this.chartGgCanvas = document.getElementById('chart-gg');

    // Contexts
    this.ctxSpeed = this.chartSpeedCanvas ? this.chartSpeedCanvas.getContext('2d') : null;
    this.ctxPedals = this.chartPedalsCanvas ? this.chartPedalsCanvas.getContext('2d') : null;
    this.ctxRpm = this.chartRpmCanvas ? this.chartRpmCanvas.getContext('2d') : null;
    this.ctxTemps = this.chartTempsCanvas ? this.chartTempsCanvas.getContext('2d') : null;
    this.ctxGg = this.chartGgCanvas ? this.chartGgCanvas.getContext('2d') : null;

    this.lastRenderTime = 0;
  }

  update(packet, playerPhysics, ai1Physics, ai2Physics, sessionState) {
    if (!packet) return;

    // 1. Update Top Status Bar
    this.updateStatusBar(packet, sessionState);

    // 2. Update Critical Live Numerical & Bar Displays
    this.updateMetricsPanel(packet);

    // 3. Update Tire Thermal Matrix & Brakes
    this.updateTiresAndBrakes(packet);

    // 4. Update Leaderboard & Sector Splits
    this.updateLeaderboard(playerPhysics, ai1Physics, ai2Physics);

    // 5. Update Engineering Event Log
    this.updateEventLog();

    // 6. Update Intelligent Recommendations
    this.updateRecommendations(packet);

    // 7. Render High-Performance Rolling Canvas Charts (throttled to ~30-60 fps)
    const now = performance.now();
    if (now - this.lastRenderTime > 25) { // ~40 fps chart draw is smooth and CPU-light
      this.lastRenderTime = now;
      this.renderCharts();
    }
  }

  updateStatusBar(packet, sessionState) {
    const elState = document.getElementById('dash-session-state');
    const elMode = document.getElementById('dash-mode-badge');
    const elPacketRate = document.getElementById('dash-packet-rate');
    const elPing = document.getElementById('dash-ping');
    const elLap = document.getElementById('dash-lap');
    const elClock = document.getElementById('dash-session-clock');

    if (elState) {
      elState.textContent = sessionState.state;
      elState.className = `status-pill state-${sessionState.state.toLowerCase()}`;
    }

    if (elMode) {
      if (this.bridge.mode === 'HARDWARE_ESP32') {
        elMode.textContent = "● IoT HARDWARE (ESP32)";
        elMode.className = "mode-pill mode-hardware";
      } else {
        elMode.textContent = "● SIMULATION INGEST";
        elMode.className = "mode-pill mode-sim";
      }
    }

    if (elPacketRate) elPacketRate.textContent = `${this.bridge.currentHz || 20} Hz`;
    if (elPing) elPing.textContent = this.bridge.isConnected ? `${this.bridge.pingMs || 8} ms` : "LOCAL";
    if (elLap) elLap.textContent = `LAP ${packet.lap_number} / ${sessionState.totalLaps || 2}`;
    
    if (elClock) {
      const totalSec = Math.floor(sessionState.sessionTime || 0);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      elClock.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
  }

  updateMetricsPanel(packet) {
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('metric-speed', Math.round(packet.speed_kmh));
    setTxt('metric-rpm', packet.engine_rpm);
    setTxt('metric-gear', packet.gear === 0 ? 'N' : packet.gear);
    setTxt('metric-throttle', `${packet.throttle_pct}%`);
    setTxt('metric-brake', `${packet.brake_pct}%`);
    setTxt('metric-steer', `${packet.steering_angle_deg}°`);
    setTxt('metric-g-long', `${packet.longitudinal_g > 0 ? '+' : ''}${packet.longitudinal_g}G`);
    setTxt('metric-g-lat', `${packet.lateral_g > 0 ? '+' : ''}${packet.lateral_g}G`);
    setTxt('metric-fuel', `${packet.fuel_remaining_kg} kg`);
    setTxt('metric-ers', `${packet.ers_soc_pct}%`);
    setTxt('metric-drs', packet.drs_status);

    // Bars
    const elThrotBar = document.getElementById('bar-throttle');
    const elBrakeBar = document.getElementById('bar-brake');
    const elRpmBar = document.getElementById('bar-rpm');

    if (elThrotBar) elThrotBar.style.width = `${packet.throttle_pct}%`;
    if (elBrakeBar) elBrakeBar.style.width = `${packet.brake_pct}%`;
    if (elRpmBar) {
      const pct = Math.min(100, Math.max(0, ((packet.engine_rpm - 4000) / 11200) * 100));
      elRpmBar.style.width = `${pct}%`;
      // Shift indicator color
      if (packet.engine_rpm > 14600) {
        elRpmBar.style.backgroundColor = '#d500f9'; // Purple shift point
      } else if (packet.engine_rpm > 13800) {
        elRpmBar.style.backgroundColor = '#ff1744'; // Red
      } else {
        elRpmBar.style.backgroundColor = '#00e676'; // Green
      }
    }

    // Delta display
    const elDelta = document.getElementById('metric-delta');
    if (elDelta) {
      const sign = packet.delta_s > 0 ? '+' : '';
      elDelta.textContent = `${sign}${packet.delta_s.toFixed(3)}s`;
      elDelta.className = packet.delta_s <= 0 ? 'metric-val delta-green' : 'metric-val delta-red';
    }
  }

  updateTiresAndBrakes(packet) {
    const tires = packet.tires;
    const brakes = packet.brakes;

    const setTire = (id, temp, wear, brakeTemp) => {
      const elTemp = document.getElementById(`tire-temp-${id}`);
      const elWear = document.getElementById(`tire-wear-${id}`);
      const elBrake = document.getElementById(`brake-temp-${id}`);
      const elBox = document.getElementById(`tire-box-${id}`);

      if (elTemp) elTemp.textContent = `${temp}°C`;
      if (elWear) elWear.textContent = `Wear: ${wear}%`;
      if (elBrake) elBrake.textContent = `Disc: ${brakeTemp}°C`;

      // Color coding: Blue <80, Green 85-105, Orange 105-115, Red >115
      if (elBox) {
        if (temp < 80) {
          elBox.style.borderColor = '#29b6f6';
          elBox.style.boxShadow = 'inset 0 0 8px rgba(41, 182, 246, 0.2)';
        } else if (temp <= 108) {
          elBox.style.borderColor = '#00e676';
          elBox.style.boxShadow = 'inset 0 0 8px rgba(0, 230, 118, 0.2)';
        } else if (temp <= 118) {
          elBox.style.borderColor = '#ff9100';
          elBox.style.boxShadow = 'inset 0 0 8px rgba(255, 145, 0, 0.3)';
        } else {
          elBox.style.borderColor = '#ff1744';
          elBox.style.boxShadow = 'inset 0 0 12px rgba(255, 23, 68, 0.5)';
        }
      }
    };

    setTire('fl', tires.fl_temp_c, tires.avg_wear_pct, brakes.fl_temp_c);
    setTire('fr', tires.fr_temp_c, tires.avg_wear_pct, brakes.fr_temp_c);
    setTire('rl', tires.rl_temp_c, tires.avg_wear_pct, brakes.rl_temp_c);
    setTire('rr', tires.rr_temp_c, tires.avg_wear_pct, brakes.rr_temp_c);

    // Engine temperature metric
    const elEngTemp = document.getElementById('metric-engine-temp');
    if (elEngTemp) {
      elEngTemp.textContent = `${packet.engine_temp_c}°C`;
      if (packet.engine_temp_c > 114) {
        elEngTemp.className = 'metric-val temp-crit';
      } else if (packet.engine_temp_c > 106) {
        elEngTemp.className = 'metric-val temp-warn';
      } else {
        elEngTemp.className = 'metric-val temp-norm';
      }
    }
  }

  updateLeaderboard(player, ...aiCarsList) {
    if (!player) return;

    const trackLen = this.track.trackLength;
    const cars = [
      { p: player, code: player.driver.code, name: player.driver.name, num: player.driver.number, color: player.driver.color }
    ];

    const flattenedAI = Array.isArray(aiCarsList[0]) ? aiCarsList[0] : aiCarsList;
    flattenedAI.forEach(ai => {
      const phys = ai && ai.physics ? ai.physics : ai;
      if (phys && phys.driver) {
        cars.push({
          p: phys,
          code: phys.driver.code,
          name: phys.driver.name,
          num: phys.driver.number,
          color: phys.driver.color
        });
      }
    });

    cars.forEach(c => {
      c.totalDistance = ((c.p.lapCount - 1) * trackLen) + c.p.trackProgress.distance;
    });

    cars.sort((a, b) => b.totalDistance - a.totalDistance);

    const leaderDist = cars[0].totalDistance;
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    let html = '';
    cars.forEach((c, idx) => {
      const pos = idx + 1;
      const gap = idx === 0 ? "LEADER" : `+${((leaderDist - c.totalDistance) / Math.max(15, c.p.speed)).toFixed(2)}s`;
      const best = c.p.bestLapTime > 0 ? `${c.p.bestLapTime.toFixed(3)}s` : "--.---";
      const last = c.p.lastLapTime > 0 ? `${c.p.lastLapTime.toFixed(3)}s` : "--.---";
      const s1 = c.p.sector1Time > 0 ? `${c.p.sector1Time.toFixed(2)}s` : "--.--";
      const s2 = c.p.sector2Time > 0 ? `${c.p.sector2Time.toFixed(2)}s` : "--.--";

      const isYou = c.p === player ? 'class="row-player"' : '';

      html += `
        <tr ${isYou}>
          <td><span class="pos-badge pos-${pos}">P${pos}</span></td>
          <td style="color:${c.color}; font-weight:bold;">#${c.num} ${c.code}</td>
          <td>${c.p.lapCount}</td>
          <td>${gap}</td>
          <td>${last}</td>
          <td class="col-best">${best}</td>
          <td><span class="sec-chip">${s1}</span> <span class="sec-chip">${s2}</span></td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  updateEventLog() {
    const listEl = document.getElementById('engineer-event-list');
    if (!listEl) return;

    const logs = this.engine.eventLog;
    let html = '';
    const displayCount = Math.min(12, logs.length);

    for (let i = 0; i < displayCount; i++) {
      const e = logs[i];
      const sevClass = `sev-${e.severity.toLowerCase()}`;
      html += `
        <div class="event-item ${sevClass}">
          <span class="event-time">${e.time}</span>
          <span class="event-subsystem">[${e.subsystem}]</span>
          <span class="event-msg">${e.message}</span>
        </div>
      `;
    }

    if (logs.length === 0) {
      html = '<div class="event-empty">Telemetry telemetry stream active. All subsystems nominal.</div>';
    }

    listEl.innerHTML = html;
  }

  updateRecommendations(packet) {
    const recEl = document.getElementById('engineer-recommendations');
    if (!recEl) return;

    let items = [];

    // Diagnostic Rule 1: Engine Thermal Load
    if (packet.engine_temp_c > 114) {
      items.push({
        title: "CRITICAL: Engine Thermal Overload (>114°C)",
        sub: "Measured: " + packet.engine_temp_c + "°C | Safe Limit: 106°C",
        rule: "Rule: T_ice >= 114.0°C. Immediate risk of head warp.",
        action: "ACTION: Mandatory Lift-and-Coast into Turn 1 and Turn 5. Pull out of dirty wake."
      });
    } else if (packet.engine_temp_c > 106) {
      items.push({
        title: "WARNING: Elevated Power Unit Coolant Temp",
        sub: "Measured: " + packet.engine_temp_c + "°C | Limit: 106°C",
        rule: "Rule: T_ice >= 106.0°C. High radiator thermal load.",
        action: "ACTION: Short-shift at 13,000 RPM down the main straight to reduce heat flux."
      });
    }

    // Diagnostic Rule 2: Tire Blistering
    const maxTire = Math.max(packet.tires.fl_temp_c, packet.tires.fr_temp_c, packet.tires.rl_temp_c, packet.tires.rr_temp_c);
    if (maxTire > 112) {
      items.push({
        title: "WARNING: Front Axle Thermal Degradation",
        sub: "Peak Temp: " + maxTire + "°C | Target Window: 85-105°C",
        rule: "Rule: T_tire >= 112°C. Friction coefficient mu degraded by ~18%.",
        action: "ACTION: Avoid excessive curbs at Turns 3-4. Smooth corner entry steering."
      });
    }

    // Diagnostic Rule 3: Heavy Braking Delta
    if (this.engine.brakePointTurn1) {
      items.push({
        title: "TELEMETRY INSIGHT: Turn 1 Braking Point",
        sub: `Initiated at ${this.engine.brakePointTurn1}m (Speed: ${packet.speed_kmh} km/h)`,
        rule: "Rule: Chicane brake trigger threshold > 60% pedal pressure.",
        action: "ACTION: Braking is consistent. You can push braking point 10m later with high downforce."
      });
    }

    if (items.length === 0) {
      items.push({
        title: "SUBSYSTEM HEALTH: OPTIMAL",
        sub: "All powertrain, aerodynamic, and brake sensors within nominal tolerances.",
        rule: "Rule: Ingest parameters within 3-sigma standard envelope.",
        action: "ACTION: Push for optimal lap time. Full ERS deployment permitted."
      });
    }

    let html = '';
    items.forEach(it => {
      html += `
        <div class="rec-card">
          <div class="rec-title">${it.title}</div>
          <div class="rec-sub">${it.sub}</div>
          <div class="rec-rule">${it.rule}</div>
          <div class="rec-action">${it.action}</div>
        </div>
      `;
    });

    recEl.innerHTML = html;
  }

  // --------------------------------------------------------------------------
  // HIGH-PERFORMANCE ROLLING CANVAS CHARTS
  // --------------------------------------------------------------------------
  renderCharts() {
    const buf = this.engine.rollingBuffer;
    if (buf.length < 2) return;

    // 1. Speed Chart
    this.drawTraceChart(
      this.ctxSpeed,
      this.chartSpeedCanvas,
      buf.map(s => s.speed_kmh),
      0,
      360,
      '#00e5ff',
      'Speed (km/h)',
      [100, 200, 300]
    );

    // 2. Dual Throttle & Brake Chart
    this.drawDualPedalChart(this.ctxPedals, this.chartPedalsCanvas, buf);

    // 3. RPM & Gear Chart
    this.drawRpmChart(this.ctxRpm, this.chartRpmCanvas, buf);

    // 4. Tire & Engine Temps Chart
    this.drawTempsChart(this.ctxTemps, this.chartTempsCanvas, buf);

    // 5. G-G Diagram (Traction Circle)
    this.drawGgDiagram(this.ctxGg, this.chartGgCanvas, buf);
  }

  drawTraceChart(ctx, canvas, data, minY, maxY, color, label, gridLines = []) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background & Grid
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    gridLines.forEach(val => {
      const y = h - ((val - minY) / (maxY - minY)) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = '#5c6f84';
      ctx.font = '9px monospace';
      ctx.fillText(String(val), 6, y - 2);
    });

    // Draw Trace
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const len = data.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const normY = THREE.MathUtils.clamp((data[i] - minY) / (maxY - minY), 0, 1);
      const y = h - (normY * h);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Chart Title & Latest Value
    const latest = data[data.length - 1];
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${label}: ${latest}`, w - 130, 16);
  }

  drawDualPedalChart(ctx, canvas, buf) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Mid grid lines
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    [25, 50, 75].forEach(pct => {
      const y = h - (pct / 100) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    });

    // Throttle Trace (Green)
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.beginPath();
    buf.forEach((s, i) => {
      const x = (i / (buf.length - 1)) * w;
      const y = h - (s.throttle_pct / 100) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Brake Trace (Red)
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 2;
    ctx.beginPath();
    buf.forEach((s, i) => {
      const x = (i / (buf.length - 1)) * w;
      const y = h - (s.brake_pct / 100) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Legend
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#00e676';
    ctx.fillText(`THROT: ${buf[buf.length - 1].throttle_pct}%`, w - 170, 16);
    ctx.fillStyle = '#ff1744';
    ctx.fillText(`BRAKE: ${buf[buf.length - 1].brake_pct}%`, w - 85, 16);
  }

  drawRpmChart(ctx, canvas, buf) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    buf.forEach((s, i) => {
      const x = (i / (buf.length - 1)) * w;
      const y = h - ((s.engine_rpm - 3500) / 12000) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffd600';
    ctx.fillText(`RPM: ${buf[buf.length - 1].engine_rpm} | GEAR: ${buf[buf.length - 1].gear}`, w - 180, 16);
  }

  drawTempsChart(ctx, canvas, buf) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Engine Temp (Orange)
    ctx.strokeStyle = '#ff9100';
    ctx.lineWidth = 2;
    ctx.beginPath();
    buf.forEach((s, i) => {
      const x = (i / (buf.length - 1)) * w;
      const y = h - ((s.engine_temp_c - 60) / 70) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Tire Temp Front (Cyan)
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    buf.forEach((s, i) => {
      const x = (i / (buf.length - 1)) * w;
      const y = h - ((s.tires.fl_temp_c - 60) / 70) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#ff9100';
    ctx.fillText(`ENG: ${buf[buf.length - 1].engine_temp_c}°C`, w - 160, 16);
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`TIRE FL: ${buf[buf.length - 1].tires.fl_temp_c}°C`, w - 85, 16);
  }

  drawGgDiagram(ctx, canvas, buf) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxG = 5.0; // 5G outer boundary
    const scale = (Math.min(w, h) / 2 - 12) / maxG;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Crosshairs
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.stroke();

    // 2G, 4G Concentric Circles
    [2, 4].forEach(g => {
      ctx.strokeStyle = '#233246';
      ctx.beginPath();
      ctx.arc(cx, cy, g * scale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '8px monospace';
      ctx.fillText(`${g}G`, cx + (g * scale) + 2, cy - 2);
    });

    // Plot G-force points with fading trail
    const count = Math.min(80, buf.length);
    for (let i = buf.length - count; i < buf.length; i++) {
      const s = buf[i];
      const alpha = (i - (buf.length - count)) / count;
      const px = cx + (s.lateral_g * scale);
      const py = cy - (s.longitudinal_g * scale); // Up is positive acceleration

      ctx.fillStyle = i === buf.length - 1 ? '#00e5ff' : `rgba(0, 229, 255, ${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py, i === buf.length - 1 ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText("G-G TRACTION CIRCLE", 8, 14);
  }
}

window.DashboardUI = DashboardUI;
