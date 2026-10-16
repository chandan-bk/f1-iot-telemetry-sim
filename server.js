/**
 * ============================================================================
 * Application of IoT in Motorsport: Real-Time Race Car Telemetry Monitoring
 * Telemetry Server & WebSocket Gateway (Node.js)
 * ============================================================================
 * Handles:
 *  1. Static web asset serving (Driver 3D Simulator & Pitwall Engineering Dashboard)
 *  2. Real-time bi-directional WebSocket telemetry stream (/telemetry-stream)
 *  3. REST endpoint for physical IoT ESP32 ingest (POST /api/telemetry/ingest)
 *  4. Multi-client broadcast (allows driving on PC while engineer monitors on tablet)
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

let express;
let WebSocket;

try {
  express = require('express');
} catch (e) {
  express = null;
}

try {
  WebSocket = require('ws');
} catch (e) {
  WebSocket = null;
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for standalone static server fallback
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

// Telemetry State Cache
let latestTelemetryPacket = null;
let telemetryHistoryBuffer = [];
const MAX_BUFFER_SIZE = 500;
let connectedClients = new Set();
let hardwareStatus = {
  esp32Connected: false,
  lastSeenMs: 0,
  packetCount: 0,
  batteryVoltage: 3.7,
  rssi_dbm: -58
};

let server;

if (express) {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  // REST ingest for ESP32 or HTTP IoT devices
  app.post('/api/telemetry/ingest', (req, res) => {
    const packet = req.body;
    handleIncomingPacket(packet, 'esp32_http');
    res.json({ status: 'ACK', timestamp: Date.now() });
  });

  // Query latest telemetry
  app.get('/api/telemetry/latest', (req, res) => {
    res.json(latestTelemetryPacket || { status: 'NO_DATA' });
  });

  // Query hardware bridge status
  app.get('/api/hardware-status', (req, res) => {
    const isAlive = (Date.now() - hardwareStatus.lastSeenMs) < 3000;
    res.json({
      ...hardwareStatus,
      esp32Connected: isAlive,
      connectedDashboardClients: connectedClients.size
    });
  });

  server = http.createServer(app);
} else {
  // Pure Node.js built-in HTTP server fallback
  server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = parsedUrl.pathname;

    if (pathname === '/api/telemetry/ingest' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const packet = JSON.parse(body);
          handleIncomingPacket(packet, 'esp32_http');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ACK', timestamp: Date.now() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (pathname === '/api/telemetry/latest') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latestTelemetryPacket || { status: 'NO_DATA' }));
      return;
    }

    if (pathname === '/api/hardware-status') {
      const isAlive = (Date.now() - hardwareStatus.lastSeenMs) < 3000;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...hardwareStatus,
        esp32Connected: isAlive,
        connectedDashboardClients: connectedClients.size
      }));
      return;
    }

    // Serve static files
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    const filePath = path.join(PUBLIC_DIR, pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Server Error: ' + err.code);
        }
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}

// WebSocket Server initialization
if (WebSocket) {
  const wss = new WebSocket.Server({ server, path: '/telemetry-stream' });

  wss.on('connection', (ws, req) => {
    connectedClients.add(ws);
    console.log(`[WS] Client connected. Total dashboard clients: ${connectedClients.size}`);

    // Send latest known telemetry upon connection
    if (latestTelemetryPacket) {
      ws.send(JSON.stringify({ type: 'TELEMETRY_SYNC', data: latestTelemetryPacket }));
    }

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'TELEMETRY_INGEST') {
          handleIncomingPacket(parsed.data, parsed.source || 'client_ws');
        } else if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (err) {
        console.error('[WS] Error parsing message:', err.message);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${connectedClients.size}`);
    });
  });
}

function handleIncomingPacket(packet, source) {
  if (!packet) return;

  packet.server_received_at = Date.now();
  latestTelemetryPacket = packet;

  // Track hardware heartbeat if from ESP32
  if (source.includes('esp32')) {
    hardwareStatus.esp32Connected = true;
    hardwareStatus.lastSeenMs = Date.now();
    hardwareStatus.packetCount++;
    if (packet.battery_v) hardwareStatus.batteryVoltage = packet.battery_v;
    if (packet.rssi_dbm) hardwareStatus.rssi_dbm = packet.rssi_dbm;
  }

  // Push to buffer
  telemetryHistoryBuffer.push(packet);
  if (telemetryHistoryBuffer.length > MAX_BUFFER_SIZE) {
    telemetryHistoryBuffer.shift();
  }

  // Broadcast to all active browser dashboards
  const broadcastMsg = JSON.stringify({ type: 'TELEMETRY_UPDATE', data: packet });
  for (const client of connectedClients) {
    if (client.readyState === 1) { // OPEN
      client.send(broadcastMsg);
    }
  }
}

server.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(`  FORMULA 1 IoT TELEMETRY & RACE SIMULATOR`);
  console.log(`  Capstone Project: "Application of IoT in Motorsport"`);
  console.log(`================================================================`);
  console.log(`  ✓ Web Application:   http://localhost:${PORT}`);
  console.log(`  ✓ WebSocket Gateway: ws://localhost:${PORT}/telemetry-stream`);
  console.log(`  ✓ ESP32 Ingest URL:  http://localhost:${PORT}/api/telemetry/ingest`);
  console.log(`================================================================\n`);
});
