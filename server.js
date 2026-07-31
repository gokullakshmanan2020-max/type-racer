/* ============================================================
 * TYPE RACER - SPEED RUSH : online multiplayer server
 * Serves the game files AND the WebSocket room service.
 *
 *   npm install   (installs the "ws" dependency)
 *   npm start     (serves game at http://localhost:3000)
 *
 * On a hosting service set PORT env (Render/Railway/Glitch do this).
 * ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MAX_PLAYERS = 4;
const CODE_LEN = 4;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wav": "audio/wav"
};

const rooms = new Map(); // roomCode -> room

/* ---------------- static file server ---------------- */

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

/* ---------------- room helpers ---------------- */

function makeCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < CODE_LEN; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  } while (rooms.has(code));
  return code;
}

function makeId() { return Math.random().toString(36).slice(2, 10); }

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  for (const ws of room.players.keys()) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function roomUpdate(room) {
  broadcast(room, {
    type: "players",
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, host: p.host })),
    finished: [...room.finished.values()].map((p) => p.name)
  });
}

function leaveRoom(ws) {
  const room = [...rooms.values()].find((r) => r.players.has(ws));
  if (!room) return;
  const info = room.players.get(ws);
  room.players.delete(ws);
  room.finished.delete(ws);
  if (ws === room.host && room.players.size > 0) {
    room.host = room.players.keys().next().value;
    const first = room.players.get(room.host);
    first.host = true;
  }
  if (room.players.size === 0) { rooms.delete(room.code); return; }
  broadcast(room, { type: "playerLeft", name: info.name });
  roomUpdate(room);
  /* everyone finished (or just left)? publish results */
  checkResults(room);
}

function checkResults(room) {
  if (room.finished.size >= room.players.size) {
    const results = [...room.finished.values()]
      .map((p) => ({ id: p.id, name: p.name, time: p.stats.time, wpm: p.stats.wpm, accuracy: p.stats.accuracy }))
      .sort((a, b) => a.time - b.time);
    room.finished.clear();
    broadcast(room, { type: "results", results });
  }
}

/* ---------------- WebSocket ---------------- */

function handleMessage(ws, msg) {
  if (msg.type === "create") {
    if (ws.room) return;
    const code = makeCode();
    const id = makeId();
    const room = { code, host: ws, players: new Map(), finished: new Map(), text: null };
    room.players.set(ws, { id, name: String(msg.name || "RACER").slice(0, 16), host: true });
    rooms.set(code, room);
    ws.room = room;
    send(ws, { type: "created", youId: id, code, host: true, players: [{ id, name: msg.name || "RACER", host: true }] });
    return;
  }
  if (msg.type === "join") {
    if (ws.room) return;
    const code = String(msg.code || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) { send(ws, { type: "error", msg: "Room not found" }); return; }
    if (room.players.size >= MAX_PLAYERS) { send(ws, { type: "error", msg: "Room is full" }); return; }
    const id = makeId();
    room.players.set(ws, { id, name: String(msg.name || "RACER").slice(0, 16), host: false });
    ws.room = room;
    send(ws, {
      type: "joined",
      youId: id,
      code,
      host: false,
      players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, host: p.host }))
    });
    roomUpdate(room);
    return;
  }
  if (!ws.room) return;
  const room = ws.room;

  if (msg.type === "start") {
    if (ws !== room.host) return;
    room.text = String(msg.text || "");
    room.finished.clear();
    broadcast(room, { type: "starting", text: room.text });
    return;
  }
  if (msg.type === "state") {
    const info = room.players.get(ws);
    if (!info) return;
    for (const other of room.players.keys()) {
      if (other !== ws && other.readyState === 1) {
        other.send(JSON.stringify({ type: "state", from: info.name, progress: msg.progress, speed01: msg.speed01, wpm: msg.wpm }));
      }
    }
    return;
  }
  if (msg.type === "finish") {
    const info = room.players.get(ws);
    if (!info || room.finished.has(ws)) return;
    const stats = { time: msg.time || 0, wpm: msg.wpm || 0, accuracy: msg.accuracy || 0, mistakes: msg.mistakes || 0 };
    room.finished.set(ws, { id: info.id, name: info.name, stats });
    broadcast(room, { type: "playerFinished", name: info.name, time: stats.time, wpm: stats.wpm, accuracy: stats.accuracy });
    checkResults(room);
    return;
  }
  if (msg.type === "leave") {
    leaveRoom(ws);
    ws.room = null;
  }
}

function startServer(port) {
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    ws.room = null;
    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }
      handleMessage(ws, msg);
    });
    ws.on("close", () => { leaveRoom(ws); ws.room = null; });
    ws.on("error", () => { /* ignore */ });
  });
  /* keep the connection alive through proxies / idle timeouts */
  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  wss.on("connection", (ws) => { ws.isAlive = true; ws.on("pong", () => { ws.isAlive = true; }); });
  return new Promise((resolve) => {
    server.listen(port, () => resolve({ server, wss, close: () => { clearInterval(hb); server.close(); wss.close(); } }));
  });
}

if (require.main === module) {
  startServer(PORT).then(({ server }) => {
    console.log("TYPE RACER online server running at http://localhost:" + server.address().port);
  });
}

module.exports = { startServer, rooms };
