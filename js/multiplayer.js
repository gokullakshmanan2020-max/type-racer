/* ============================================================
 * TYPE RACER - SPEED RUSH
 * multiplayer.js — client for the online room server.
 * Talks to server.js over WebSocket: create/join rooms,
 * relay race state, collect results.
 * ============================================================ */
window.TR = window.TR || {};

TR.Multiplayer = class Multiplayer {
  constructor(app) {
    this.app = app;
    this.ws = null;
    this.room = null;        // { code, host: bool }
    this.youId = null;
    this.players = [];       // [{ id, name, host }]
    this.states = new Map(); // name -> { progress, speed01, wpm }
    this.wheel = {};         // id -> numeric wheel rotation (track renderer expects a number)
    this.finished = [];      // names who finished
    this.results = null;     // server standings after race
    this._stateT = 0;
  }

  get inRoom() { return !!this.room; }
  get amHost() { return !!(this.room && this.room.host); }
  get playerCount() { return this.players.length; }

  /* same-origin when served by server.js; local fallback for file:// */
  _url() {
    if (window.location.protocol !== "file:") {
      return (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host;
    }
    return TR.Config.WS_URL;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws) { resolve(); return; }
      let ws;
      try { ws = new WebSocket(this._url()); } catch (e) { reject(new Error("WebSocket unsupported")); return; }
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => { this.ws = null; reject(new Error("Cannot reach the game server")); };
      ws.onclose = () => {
        this.ws = null;
        if (this.inRoom && this.app.onMpClosed) this.app.onMpClosed();
        this.room = null;
        this.youId = null;
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        this._onMessage(m);
      };
    });
  }

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }

  create(name) { this.send({ type: "create", name }); }
  join(code, name) { this.send({ type: "join", code: String(code).toUpperCase().trim(), name }); }
  start(text) { this.send({ type: "start", text }); }
  finish(stats) { this.send({ type: "finish", time: stats.time, wpm: stats.wpm, accuracy: stats.accuracy, mistakes: stats.mistakes }); }

  leave() {
    if (this.inRoom) this.send({ type: "leave" });
    if (this.ws) { try { this.ws.close(); } catch (e) { /* ignore */ } }
    this.ws = null;
    this.room = null;
    this.youId = null;
    this.players = [];
    this.states.clear();
    this.wheel = {};
    this.finished = [];
    this.results = null;
  }

  /* called from the game loop at ~10Hz while racing */
  tick(dt) {
    if (!this.inRoom || this.app.phase !== "racing") return;
    for (const p of this.players) this.wheel[p.id] = (this.wheel[p.id] || 0) + dt * 5;
    this._stateT -= dt;
    if (this._stateT <= 0) {
      this._stateT = 0.1;
      this.send({
        type: "state",
        progress: this.app.player.progress,
        speed01: this.app.player.speed01,
        wpm: this.app.typing ? this.app.typing.liveWpm(performance.now()) : 0
      });
    }
  }

  /* remote cars for the track renderer: {progress,color,accent,phase,finished} */
  cars() {
    const palette = TR.Config.AI_CARS;
    let i = 0;
    return this.players
      .filter((p) => p.id !== this.youId)
      .map((p) => {
        const s = this.states.get(p.name) || {};
        const def = palette[i % palette.length];
        i++;
        return {
          name: p.name,
          progress: s.progress || 0,
          speed01: s.speed01 || 0,
          wpm: s.wpm || 0,
          color: def.color,
          accent: def.accent,
          phase: this.wheel[p.id] || 0,
          finished: this.finished.indexOf(p.name) !== -1
        };
      });
  }

  /* live position among remote players */
  position(playerProgress) {
    let pos = 1;
    for (const p of this.players) {
      if (p.id === this.youId) continue;
      const s = this.states.get(p.name) || {};
      if ((s.progress || 0) >= playerProgress) pos++;
    }
    return pos;
  }

  _onMessage(m) {
    switch (m.type) {
      case "created":
        this.room = { code: m.code, host: true };
        this.youId = m.youId;
        this.players = m.players;
        if (this.app.onMpJoined) this.app.onMpJoined(m);
        break;
      case "joined":
        this.room = { code: m.code, host: false };
        this.youId = m.youId;
        this.players = m.players;
        if (this.app.onMpJoined) this.app.onMpJoined(m);
        break;
      case "players":
        this.players = m.players;
        this.finished = m.finished || [];
        if (this.app.onMpPlayers) this.app.onMpPlayers();
        break;
      case "starting":
        if (this.app.onMpStarting) this.app.onMpStarting(m.text);
        break;
      case "state":
        this.states.set(m.from, { progress: m.progress, speed01: m.speed01, wpm: m.wpm });
        break;
      case "playerFinished":
        if (this.finished.indexOf(m.name) === -1) this.finished.push(m.name);
        if (this.app.onMpPlayerFinished) this.app.onMpPlayerFinished(m.name, m);
        break;
      case "results":
        this.results = m.results;
        if (this.app.onMpResults) this.app.onMpResults(m.results);
        break;
      case "playerLeft":
        this.states.delete(m.name);
        if (this.app.onMpPlayers) this.app.onMpPlayers();
        break;
      case "error":
        if (this.app.onMpError) this.app.onMpError(m.msg);
        break;
    }
  }
};
