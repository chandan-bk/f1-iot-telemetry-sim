/**
 * ============================================================================
 * MAIN SIMULATION CONTROLLER & GAME ORCHESTRATOR
 * Formula 1 IoT Telemetry & Race Simulator (High-Realism Edition)
 * ============================================================================
 * Implements:
 *  - 6-Car Grand Prix Starting Grid (Player + 5 AI Opponents)
 *  - 3 Realistic Cameras:
 *      * COCKPIT: Driver Eye POV through Halo & 3D Steering Wheel with Hands
 *      * CHASE: Dynamic chase camera with speed lag & FOV warp
 *      * TV_BROADCAST: Trackside telephoto camera towers with auto-panning
 *  - Live Broadcast Timing Tower HUD with interval gaps (Image 1 style)
 *  - Circular GPS Track Radar in Cockpit HUD (Image 2 style)
 *  - Interactive on-screen pedals (brake & throttle footpads)
 *  - 20Hz Synchronous Telemetry sampling to WebSocket & Pitwall Dashboard
 * ============================================================================
 */

class F1SimApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Game & Session State
    this.session = {
      mode: 'QUICK_RACE', // 'QUICK_RACE' | 'TIME_TRIAL'
      state: 'READY',     // 'READY' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'FINISHED'
      totalLaps: 3,
      sessionTime: 0,
      countdownTimer: 0,
      countdownLights: 0
    };

    // Subsystems
    this.track = null;
    this.playerCar = null;
    this.playerPhysics = null;
    this.aiCars = [];
    this.aiControllers = [];
    this.audio = null;
    this.telemetry = null;
    this.bridge = null;
    this.dashboard = null;
    this.trackMap = null;
    this.postRace = null;

    // Camera Configuration: COCKPIT (Default) | CHASE | TV_BROADCAST
    this.cameraMode = 'COCKPIT';
    this.activeViewLayout = 'SPLIT'; // 'DRIVER_ONLY' | 'SPLIT' | 'ENGINEER_ONLY'

    // Input State
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      handbrake: false,
      drs: false
    };

    // Selected Driver
    this.selectedDriverIndex = 0;

    this.init();
  }

  init() {
    this.setupThreeJS();
    this.setupAudio();
    this.setupTrackAndCars();
    this.setupSubsystems();
    this.setupInputListeners();
    this.setupUIHandlers();

    // Start Main Render Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    console.log("✓ F1 IoT Telemetry Simulator (High Realism) initialized.");
  }

  setupThreeJS() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb6cddc);
    this.scene.fog = new THREE.FogExp2(0xb8cddc, 0.0014);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(76, aspect, 0.08, 2800);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.container.appendChild(this.renderer.domElement);

    // Atmospheric Grand Prix Sky Dome with natural overcast horizon haze (Image 1)
    const skyGeo = new THREE.SphereGeometry(1400, 32, 24);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 128;
    skyCanvas.height = 256;
    const sCtx = skyCanvas.getContext('2d');
    const sGrad = sCtx.createLinearGradient(0, 0, 0, 256);
    sGrad.addColorStop(0, '#537494');    // Overcast slate blue zenith
    sGrad.addColorStop(0.55, '#8aa8c0'); // Mid atmospheric gradient
    sGrad.addColorStop(0.85, '#bccad6'); // Horizon fog mist
    sGrad.addColorStop(1, '#9dafb8');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 256);

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyDome);

    // Natural Ambient Sky Bounce & Directional Sun Lighting
    const hemiLight = new THREE.HemisphereLight(0xe8f0f8, 0x444b54, 0.78);
    hemiLight.position.set(0, 200, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff8ee, 1.35);
    dirLight.position.set(140, 260, 190);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 700;
    const shadowD = 140;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    this.scene.add(dirLight);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupAudio() {
    this.audio = new F1AudioEngine();
    window.f1Audio = this.audio;
  }

  setupTrackAndCars() {
    // 1. Build 3D Circuit Track
    this.track = new CircuitTrack(this.scene);

    // 2. Build Player Car
    const pDriver = window.F1_CONFIG.DRIVERS[this.selectedDriverIndex];
    this.playerCar = new F1CarModel(pDriver);
    this.scene.add(this.playerCar.root);
    this.playerPhysics = new VehiclePhysics(this.playerCar, this.track, pDriver);
    this.playerPhysics.resetToGrid(0); // Pole Position

    // 3. Build Full 5-Car AI Opponents Field (6 Cars Total on Track)
    this.aiCars = [];
    this.aiControllers = [];

    const allDrivers = window.F1_CONFIG.DRIVERS;
    for (let i = 1; i < allDrivers.length; i++) {
      const aiDriver = allDrivers[i];
      const aiModel = new F1CarModel(aiDriver);
      this.scene.add(aiModel.root);

      const aiPhys = new VehiclePhysics(aiModel, this.track, aiDriver);
      aiPhys.resetToGrid(i); // Grid Slots 2 to 6
      this.aiCars.push({ model: aiModel, physics: aiPhys });
      this.aiControllers.push(new AIDriverController(aiPhys, aiDriver, this.track));
    }
  }

  setupSubsystems() {
    this.telemetry = new TelemetryEngine(this.playerPhysics, this.track);
    this.bridge = new IoTTelemetryBridge();
    this.dashboard = new DashboardUI(this.telemetry, this.bridge, this.track);

    const mapCanvas = document.getElementById('track-map-canvas');
    if (mapCanvas) {
      this.trackMap = new TrackMapRenderer(mapCanvas, this.track);
    }

    this.postRace = new PostRaceAnalysis(this.telemetry);
  }

  setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      if (this.audio && !this.audio.isInitialized) {
        this.audio.init();
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          this.highlightPedal('throttle', true);
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          this.highlightPedal('brake', true);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Space':
          this.keys.handbrake = true;
          this.highlightPedal('brake', true);
          break;
        case 'KeyC':
          this.toggleCamera();
          break;
        case 'KeyR':
          this.resetPlayerCar();
          break;
        case 'KeyM':
          this.audio.toggleMute();
          break;
        case 'KeyT':
          this.cycleViewLayout();
          break;
        case 'Escape':
          this.togglePause();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          this.highlightPedal('throttle', false);
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          this.highlightPedal('brake', false);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'Space':
          this.keys.handbrake = false;
          this.highlightPedal('brake', false);
          break;
      }
    });
  }

  highlightPedal(type, isActive) {
    const el = document.getElementById(type === 'brake' ? 'hud-brake-pedal' : 'hud-throttle-pedal');
    if (el) {
      el.classList.toggle(type === 'brake' ? 'active-brake' : 'active-throttle', isActive);
    }
  }

  setupUIHandlers() {
    const btnQuickRace = document.getElementById('btn-start-quick-race');
    const btnTimeTrial = document.getElementById('btn-start-time-trial');
    const btnHardwareMode = document.getElementById('btn-hardware-mode');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnReturnMenu = document.getElementById('btn-return-menu');
    const btnLayoutDriver = document.getElementById('btn-view-driver');
    const btnLayoutSplit = document.getElementById('btn-view-split');
    const btnLayoutEngineer = document.getElementById('btn-view-engineer');
    const modeToggle = document.getElementById('btn-toggle-iot-mode');
    const btnQuickCam = document.getElementById('btn-quick-cam');

    if (btnQuickRace) btnQuickRace.onclick = () => this.startRace('QUICK_RACE');
    if (btnTimeTrial) btnTimeTrial.onclick = () => this.startRace('TIME_TRIAL');
    if (btnHardwareMode) {
      btnHardwareMode.onclick = () => {
        this.bridge.setMode('HARDWARE_ESP32');
        this.startRace('QUICK_RACE');
      };
    }
    if (modeToggle) {
      modeToggle.onclick = () => {
        const next = this.bridge.mode === 'SIMULATION' ? 'HARDWARE_ESP32' : 'SIMULATION';
        this.bridge.setMode(next);
      };
    }
    if (btnExportCsv) btnExportCsv.onclick = () => this.postRace.exportCSV();
    if (btnReturnMenu) btnReturnMenu.onclick = () => this.showScreen('screen-menu');
    if (btnQuickCam) btnQuickCam.onclick = () => this.toggleCamera();

    if (btnLayoutDriver) btnLayoutDriver.onclick = () => this.setViewLayout('DRIVER_ONLY');
    if (btnLayoutSplit) btnLayoutSplit.onclick = () => this.setViewLayout('SPLIT');
    if (btnLayoutEngineer) btnLayoutEngineer.onclick = () => this.setViewLayout('ENGINEER_ONLY');

    const btnMute = document.getElementById('btn-audio-mute');
    if (btnMute) {
      btnMute.onclick = () => {
        const muted = this.audio.toggleMute();
        btnMute.textContent = muted ? "🔇 UNMUTE" : "🔊 MUTE";
      };
    }
  }

  startRace(mode) {
    this.session.mode = mode;
    this.session.state = 'COUNTDOWN';
    this.session.sessionTime = 0;
    this.session.countdownTimer = 5.0;
    this.session.countdownLights = 0;

    // Reset player & all AI cars to grid slots
    this.playerPhysics.resetToGrid(0);
    this.aiCars.forEach((ai, idx) => {
      ai.physics.resetToGrid(idx + 1);
    });

    if (this.audio) this.audio.init();

    const wheelDash = document.getElementById('hud-wheel-dash');
    if (wheelDash) {
      wheelDash.classList.toggle('hide-2d-wheel', this.cameraMode === 'COCKPIT');
    }

    this.showScreen('screen-race');
    this.setViewLayout('SPLIT');
  }

  showScreen(screenId) {
    ['screen-menu', 'screen-race', 'screen-results'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === screenId);
    });

    if (screenId === 'screen-race') {
      this.onWindowResize();
    }
  }

  setViewLayout(layout) {
    this.activeViewLayout = layout;
    const simWrapper = document.getElementById('sim-viewport-wrapper');
    const pitwallWrapper = document.getElementById('pitwall-wrapper');

    if (!simWrapper || !pitwallWrapper) return;

    simWrapper.className = 'view-panel';
    pitwallWrapper.className = 'view-panel';

    if (layout === 'DRIVER_ONLY') {
      simWrapper.classList.add('view-full');
      pitwallWrapper.classList.add('view-hidden');
    } else if (layout === 'ENGINEER_ONLY') {
      simWrapper.classList.add('view-hidden');
      pitwallWrapper.classList.add('view-full');
    } else {
      simWrapper.classList.add('view-split-left');
      pitwallWrapper.classList.add('view-split-right');
    }

    setTimeout(() => this.onWindowResize(), 50);
  }

  cycleViewLayout() {
    const modes = ['SPLIT', 'DRIVER_ONLY', 'ENGINEER_ONLY'];
    const nextIdx = (modes.indexOf(this.activeViewLayout) + 1) % modes.length;
    this.setViewLayout(modes[nextIdx]);
  }

  // Camera Cycle: COCKPIT -> CHASE -> TV_BROADCAST
  toggleCamera() {
    const order = ['COCKPIT', 'CHASE', 'TV_BROADCAST'];
    const curIdx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(curIdx + 1) % order.length];

    const label = document.getElementById('cam-mode-label');
    if (label) label.textContent = this.cameraMode;

    // In Cockpit mode, hide the 2D steering wheel HUD since the 3D wheel is visible!
    const wheelDash = document.getElementById('hud-wheel-dash');
    if (wheelDash) {
      wheelDash.classList.toggle('hide-2d-wheel', this.cameraMode === 'COCKPIT');
    }
  }

  resetPlayerCar() {
    const u = this.playerPhysics.trackProgress.u;
    const pt = this.track.curve.getPointAt(u);
    const tangent = this.track.curve.getTangentAt(u);

    this.playerPhysics.position.copy(pt).add(new THREE.Vector3(0, 0.2, 0));
    this.playerPhysics.velocity.set(0, 0, 0);
    this.playerPhysics.speed = 0;
    this.playerPhysics.speedKmh = 0;
    this.playerPhysics.heading = Math.atan2(tangent.x, tangent.z);
    this.playerPhysics.rpm = window.F1_CONFIG.VEHICLE.idleRpm;
  }

  togglePause() {
    if (this.session.state === 'RUNNING') {
      this.session.state = 'PAUSED';
    } else if (this.session.state === 'PAUSED') {
      this.session.state = 'RUNNING';
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(0.05, this.clock.getDelta());
    const sessionTimeMs = performance.now();

    if (this.session.state === 'COUNTDOWN') {
      this.handleCountdown(dt);
    } else if (this.session.state === 'RUNNING') {
      this.session.sessionTime += dt;
      this.updateSimulation(dt, sessionTimeMs);
    }

    // Camera Update
    this.updateCamera(dt);

    // Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }

  handleCountdown(dt) {
    this.session.countdownTimer -= dt;

    const elapsed = 5.0 - this.session.countdownTimer;
    let lightsCount = Math.floor(elapsed);
    if (lightsCount < 0) lightsCount = 0;
    if (lightsCount > 5) lightsCount = 5;

    this.track.setStartingLights(lightsCount);

    const overlay = document.getElementById('countdown-overlay');
    const lightsContainer = document.getElementById('lights-banner');

    if (overlay) overlay.style.display = 'flex';
    if (lightsContainer) {
      let dotsHtml = '';
      for (let i = 0; i < 5; i++) {
        dotsHtml += `<span class="light-dot ${i < lightsCount ? 'lit-red' : ''}"></span>`;
      }
      lightsContainer.innerHTML = dotsHtml;
    }

    if (this.session.countdownTimer <= 0) {
      this.track.setStartingLights(6); // ALL LIGHTS OUT
      this.session.state = 'RUNNING';
      if (overlay) overlay.style.display = 'none';
      if (this.audio) this.audio.playBeep(1760, 0.25);
    }
  }

  updateSimulation(dt, sessionTimeMs) {
    // 1. Player Vehicle Physics Update
    const playerInput = {
      throttle: this.keys.forward ? 1.0 : 0.0,
      brake: this.keys.backward ? 1.0 : 0.0,
      steering: (this.keys.left ? -1.0 : 0.0) + (this.keys.right ? 1.0 : 0.0),
      handbrake: this.keys.handbrake
    };

    const prevLap = this.playerPhysics.lapCount;
    this.playerPhysics.update(dt, playerInput);

    if (this.playerPhysics.lapCount > prevLap) {
      this.telemetry.onLapComplete(prevLap);
      if (this.playerPhysics.lapCount > this.session.totalLaps) {
        this.finishRace();
        return;
      }
    }

    // 2. All 5 AI Opponents Update with Collision Avoidance
    if (this.session.mode === 'QUICK_RACE') {
      this.aiControllers.forEach((ctrl, idx) => {
        const otherAI = this.aiCars[(idx + 1) % this.aiCars.length].physics;
        ctrl.update(dt, this.playerPhysics, otherAI);
      });
    }

    // 3. Audio Update
    if (this.audio) {
      this.audio.update(
        this.playerPhysics.rpm,
        this.playerPhysics.speedKmh,
        this.playerPhysics.throttle,
        this.playerPhysics.brake,
        this.playerPhysics.wheelSlip,
        this.playerPhysics.trackProgress.isOnKerb
      );
    }

    // 4. Telemetry Sampling (20Hz)
    const packet = this.telemetry.update(sessionTimeMs);
    if (packet) {
      this.bridge.sendVirtualTelemetry(packet);

      // Pass all AI cars to dashboard and track map
      const aiPhysicsList = this.aiCars.map(c => c.physics);
      this.dashboard.update(
        packet,
        this.playerPhysics,
        aiPhysicsList,
        null,
        this.session
      );

      if (this.trackMap) {
        this.trackMap.render(this.playerPhysics, aiPhysicsList);
      }

      this.updateCockpitHUD(packet);
      this.updateBroadcastTimingTower(packet);
      this.renderCockpitRadar();
    }
  }

  // Circular Mini GPS Track Radar (matching Image 2)
  renderCockpitRadar() {
    const canvas = document.getElementById('cockpit-radar-canvas');
    if (!canvas || !this.track) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark Radar Circle
    ctx.fillStyle = '#060a12';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Concentric Range Rings
    ctx.strokeStyle = '#142538';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, (w / 2) * 0.5, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, (w / 2) * 0.85, 0, Math.PI * 2);
    ctx.stroke();

    // Scaled Track Spline
    const samples = this.track.samples;
    const bounds = this.trackMap ? this.trackMap.bounds : { minX: -520, maxX: 120, minZ: -460, maxZ: 620 };
    const scale = (w - 24) / Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midZ = (bounds.minZ + bounds.maxZ) / 2;

    ctx.strokeStyle = '#254465';
    ctx.lineWidth = 3;
    ctx.beginPath();
    samples.forEach((s, idx) => {
      const cx = (w / 2) + (s.point.x - midX) * scale;
      const cy = (h / 2) + (s.point.z - midZ) * scale;
      if (idx === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.stroke();

    // Car GPS Dots
    const allCars = [{ p: this.playerPhysics, color: '#00e5ff', r: 3.8 }];
    this.aiCars.forEach(ai => allCars.push({ p: ai.physics, color: ai.physics.driver.color, r: 2.6 }));

    allCars.forEach(c => {
      if (!c.p) return;
      const cx = (w / 2) + (c.p.position.x - midX) * scale;
      const cy = (h / 2) + (c.p.position.z - midZ) * scale;
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Broadcast Timing Tower (matching Image 1)
  updateBroadcastTimingTower(packet) {
    const listEl = document.getElementById('tower-drivers-list');
    const lapEl = document.getElementById('hud-lap-badge');
    const posEl = document.getElementById('hud-pos-badge');
    const tvTimeEl = document.getElementById('tv-session-time');
    const tvBestEl = document.getElementById('tv-best-time');
    const tvDeltaEl = document.getElementById('tv-delta-time');

    if (lapEl) lapEl.textContent = `LAP ${packet.lap_number}/${this.session.totalLaps}`;

    const totalSec = this.session.sessionTime || 0;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    const ms = Math.floor((totalSec % 1) * 1000);
    if (tvTimeEl) tvTimeEl.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
    if (tvBestEl) tvBestEl.textContent = this.playerPhysics.bestLapTime > 0 ? `${this.playerPhysics.bestLapTime.toFixed(3)}s` : '--:--.---';
    if (tvDeltaEl) {
      const d = packet.delta_s || 0;
      tvDeltaEl.textContent = `${d > 0 ? '+' : ''}${d.toFixed(3)}`;
      tvDeltaEl.style.color = d <= 0 ? '#00e676' : '#ff1744';
    }

    if (!listEl) return;

    // Collect all cars & sort by completed distance
    const trackLen = this.track.trackLength;
    const cars = [
      { p: this.playerPhysics, code: this.playerPhysics.driver.code, color: this.playerPhysics.driver.color, isPlayer: true }
    ];
    this.aiCars.forEach(ai => {
      cars.push({ p: ai.physics, code: ai.physics.driver.code, color: ai.physics.driver.color, isPlayer: false });
    });

    cars.forEach(c => {
      c.totalDist = ((c.p.lapCount - 1) * trackLen) + c.p.trackProgress.distance;
    });
    cars.sort((a, b) => b.totalDist - a.totalDist);

    const leaderDist = cars[0].totalDist;
    let html = '';
    cars.forEach((c, idx) => {
      const pos = idx + 1;
      if (c.isPlayer && posEl) posEl.textContent = `POS P${pos}`;
      const gap = idx === 0 ? "LEAD" : `+${((leaderDist - c.totalDist) / Math.max(15, c.p.speed)).toFixed(2)}s`;
      const isYou = c.isPlayer ? 'is-player' : '';
      html += `
        <div class="tower-row ${isYou}">
          <span class="tower-pos">${String(pos).padStart(2, '0')}</span>
          <span class="tower-team-bar" style="background:${c.color};"></span>
          <span class="tower-code">${c.code}</span>
          <span class="tower-gap">${gap}</span>
        </div>
      `;
    });
    listEl.innerHTML = html;
  }

  updateCockpitHUD(packet) {
    const elSpeed = document.getElementById('hud-speed');
    const elGear = document.getElementById('hud-gear');
    const elRpmLeds = document.getElementById('hud-rpm-leds');
    const elSector = document.getElementById('hud-sector-num');

    if (elSpeed) elSpeed.textContent = Math.round(packet.speed_kmh);
    if (elGear) elGear.textContent = packet.gear === 0 ? 'N' : packet.gear;
    if (elSector) elSector.textContent = `SEC ${packet.current_sector}`;

    if (elRpmLeds) {
      const pct = Math.min(1.0, Math.max(0, (packet.engine_rpm - 8000) / 7000));
      const activeLeds = Math.floor(pct * 10);
      let leds = '';
      for (let i = 0; i < 10; i++) {
        let colorClass = 'led-off';
        if (i < activeLeds) {
          if (i < 4) colorClass = 'led-green';
          else if (i < 7) colorClass = 'led-red';
          else colorClass = 'led-purple';
        }
        leds += `<span class="rpm-led ${colorClass}"></span>`;
      }
      elRpmLeds.innerHTML = leds;
    }

    // Track Limits Violation & Barrier Crash Alert Banner
    const warnBanner = document.getElementById('hud-track-warning-banner');
    const warnText = document.getElementById('hud-warning-text');
    if (warnBanner && warnText && this.playerPhysics) {
      if (this.playerPhysics.hasBarrierImpact || this.playerPhysics.barrierImpactTimer > 0) {
        warnBanner.className = 'hud-warning-pill warning-barrier';
        warnText.textContent = '💥 BARRIER IMPACT - 45% SPEED LOSS';
        if (this.audio && this.playerPhysics.barrierImpactTimer > 0.72) {
          this.audio.playPitRadioAlert();
        }
      } else if (this.playerPhysics.trackLimitWarningTimer > 0) {
        warnBanner.className = 'hud-warning-pill';
        warnText.textContent = `⚠️ TRACK LIMITS VIOLATION (${this.playerPhysics.trackLimitsViolations}) - LAP INVALIDATED`;
      } else {
        warnBanner.className = 'hud-warning-pill hidden';
      }
    }
  }

  // --------------------------------------------------------------------------
  // CAMERA SYSTEM: COCKPIT POV, DYNAMIC CHASE, TV BROADCAST
  // --------------------------------------------------------------------------
  updateCamera(dt) {
    const p = this.playerPhysics;
    if (!p) return;

    if (this.cameraMode === 'COCKPIT') {
      // True Driver POV through Halo Hoop & Over 3D Steering Wheel
      if (this.playerCar && this.playerCar.setHelmetVisible) {
        this.playerCar.setHelmetVisible(false);
      }
      const forwardX = Math.sin(p.heading);
      const forwardZ = Math.cos(p.heading);
      const normalX = Math.cos(p.heading);
      const normalZ = -Math.sin(p.heading);
      const eyeHeight = 0.63;

      // 1. Dynamic G-Force Driver Head Simulation (Braking dip, accel pushback, corner sway)
      const longiHeadOffset = THREE.MathUtils.clamp(-p.longitudinalG * 0.032, -0.05, 0.07);
      const verticalHeadOffset = THREE.MathUtils.clamp(p.longitudinalG * 0.015, -0.025, 0.01);
      const lateralHeadOffset = THREE.MathUtils.clamp(-p.lateralG * 0.020, -0.06, 0.06);

      // 2. High-speed Ground Effect Chassis Rumble & Kerb Vibration
      const now = performance.now() * 0.001;
      let vibration = 0;
      if (p.speedKmh > 140) {
        vibration = Math.sin(now * 36) * (p.speedKmh / 350) * 0.006;
      }
      if (p.trackProgress && p.trackProgress.isOnKerb && p.speedKmh > 25) {
        vibration += Math.sin(now * 52) * 0.024; // High frequency rumble kerb bounce
      }

      // Barrier collision impact rumble
      let barrierShake = 0;
      if (p.barrierImpactTimer > 0) {
        barrierShake = (p.barrierImpactTimer / 0.8) * 0.12;
      }

      this.camera.position.set(
        p.position.x + forwardX * (0.14 + longiHeadOffset) + (normalX * lateralHeadOffset) + ((Math.random() - 0.5) * barrierShake),
        p.position.y + eyeHeight + verticalHeadOffset + vibration + ((Math.random() - 0.5) * barrierShake),
        p.position.z + forwardZ * (0.14 + longiHeadOffset) + (normalZ * lateralHeadOffset) + ((Math.random() - 0.5) * barrierShake)
      );

      // 3. Driver Look-Ahead (Apex Targeting into Corners)
      const apexLookFactor = p.steerAngle * 10.0;
      const targetLookX = forwardX + (normalX * apexLookFactor * 0.22);
      const targetLookZ = forwardZ + (normalZ * apexLookFactor * 0.22);

      const lookTarget = new THREE.Vector3(
        p.position.x + targetLookX * 45.0,
        p.position.y + eyeHeight - 0.07 + (verticalHeadOffset * 0.5),
        p.position.z + targetLookZ * 45.0
      );
      this.camera.lookAt(lookTarget);

      // 4. Dynamic Speed Tunnel FOV Expansion (Visceral Speed Warp)
      const targetFov = 74 + (p.speedKmh / 350) * 14;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1.0, dt * 6.0);
      this.camera.updateProjectionMatrix();

    } else if (this.cameraMode === 'CHASE') {
      if (this.playerCar && this.playerCar.setHelmetVisible) {
        this.playerCar.setHelmetVisible(true);
      }
      // Dynamic Third-Person Chase Camera with speed lag
      const forwardX = Math.sin(p.heading);
      const forwardZ = Math.cos(p.heading);

      const targetPos = new THREE.Vector3(
        p.position.x - forwardX * 6.8,
        p.position.y + 2.3,
        p.position.z - forwardZ * 6.8
      );

      this.camera.position.lerp(targetPos, Math.min(1.0, dt * 8.0));

      const lookTarget = new THREE.Vector3(
        p.position.x + forwardX * 10.0,
        p.position.y + 1.1,
        p.position.z + forwardZ * 10.0
      );
      this.camera.lookAt(lookTarget);

      const targetFov = 64 + (p.speedKmh / 350) * 16;
      this.camera.fov += (targetFov - this.camera.fov) * dt * 3.0;
      this.camera.updateProjectionMatrix();

    } else if (this.cameraMode === 'TV_BROADCAST') {
      if (this.playerCar && this.playerCar.setHelmetVisible) {
        this.playerCar.setHelmetVisible(true);
      }
      // Trackside TV Camera Towers panning smoothly across circuit (Image 1)
      const trackLen = this.track.trackLength;
      const towerDist = Math.floor(p.trackProgress.distance / 380) * 380 + 180;
      const towerU = (towerDist % trackLen) / trackLen;
      const towerSample = this.track.curve.getPointAt(towerU);
      const towerTangent = this.track.curve.getTangentAt(towerU);
      const up = new THREE.Vector3(0, 1, 0);
      const towerNormal = new THREE.Vector3().crossVectors(towerTangent, up).normalize();

      const camPos = towerSample.clone().add(towerNormal.multiplyScalar(-18)).add(new THREE.Vector3(0, 5.5, 0));
      this.camera.position.lerp(camPos, 0.08);
      this.camera.lookAt(p.position.x, p.position.y + 0.8, p.position.z);
      this.camera.fov = 42; // Telephoto TV broadcast lens
      this.camera.updateProjectionMatrix();
    }
  }

  finishRace() {
    this.session.state = 'FINISHED';
    if (this.audio) this.audio.playPitRadioAlert();
    this.postRace.populateResults(this.playerPhysics, this.aiCars, this.session.mode);
    this.showScreen('screen-results');
  }
}

// Bootstrap application on page load
window.addEventListener('DOMContentLoaded', () => {
  window.f1App = new F1SimApp();
});
