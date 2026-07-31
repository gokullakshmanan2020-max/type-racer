/* ============================================================
 * TYPE RACER - SPEED RUSH
 * storage.js — localStorage persistence layer
 * (settings, leaderboard, achievements, ghost replays, daily)
 * ============================================================ */
window.TR = window.TR || {};

TR.Storage = {
  KEYS: {
    SETTINGS: "tr.settings",
    LEADERBOARD: "tr.leaderboard",
    NAME: "tr.name",
    GHOSTS: "tr.ghosts",
    ACHIEVEMENTS: "tr.achievements",
    DAILY: "tr.daily",
    COUNTERS: "tr.counters"
  },

  /* Safe JSON read/write helpers */
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full / private mode */ }
  },

  /* ---------- Settings ---------- */
  defaultSettings() {
    return {
      sound: true,
      volume: 0.7,
      engine: true,
      difficulty: "medium",
      rain: "auto",            // auto | on | off
      night: "auto",           // auto | on | off
      theme: "neon",           // neon | sunset | midnight
      skin: "cyan",
      ghost: true,
      shake: true
    };
  },
  getSettings() {
    return Object.assign(TR.Storage.defaultSettings(), TR.Storage.get(TR.Storage.KEYS.SETTINGS, {}));
  },
  setSettings(patch) {
    TR.Storage.set(TR.Storage.KEYS.SETTINGS, Object.assign(TR.Storage.getSettings(), patch));
  },

  /* ---------- Player name ---------- */
  getName() { return TR.Storage.get(TR.Storage.KEYS.NAME, "RACER"); },
  setName(name) { TR.Storage.set(TR.Storage.KEYS.NAME, String(name).slice(0, 16) || "RACER"); },

  /* ---------- Leaderboard ---------- */
  getLeaderboard() { return TR.Storage.get(TR.Storage.KEYS.LEADERBOARD, []); },

  /* Add a score, keep top 10 sorted by WPM. Returns the entry id. */
  addScore(entry) {
    const list = TR.Storage.getLeaderboard();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const rec = Object.assign({ id }, entry);
    list.push(rec);
    list.sort((a, b) => b.wpm - a.wpm || a.time - b.time);
    const trimmed = list.slice(0, 10);
    TR.Storage.set(TR.Storage.KEYS.LEADERBOARD, trimmed);
    return { id, rank: trimmed.indexOf(rec) + 1 };
  },

  /* Rename a leaderboard entry (used when player edits name on results) */
  renameEntry(id, name) {
    const list = TR.Storage.getLeaderboard();
    const rec = list.find((r) => r.id === id);
    if (rec) { rec.name = name; TR.Storage.set(TR.Storage.KEYS.LEADERBOARD, list); }
  },

  /* ---------- Ghost replay (best run per text) ---------- */
  getGhost(text) {
    const ghosts = TR.Storage.get(TR.Storage.KEYS.GHOSTS, {});
    return ghosts[TR.hashString(text)] || null;
  },
  saveGhost(text, samples, timeSec) {
    const ghosts = TR.Storage.get(TR.Storage.KEYS.GHOSTS, {});
    const key = TR.hashString(text);
    const prev = ghosts[key];
    if (!prev || timeSec < prev.time) {
      ghosts[key] = { time: timeSec, samples };
      TR.Storage.set(TR.Storage.KEYS.GHOSTS, ghosts);
      return true;
    }
    return false;
  },

  /* ---------- Achievements ---------- */
  getAchievements() { return TR.Storage.get(TR.Storage.KEYS.ACHIEVEMENTS, {}); },
  unlock(id) {
    const list = TR.Storage.getAchievements();
    if (!list[id]) {
      list[id] = new Date().toISOString();
      TR.Storage.set(TR.Storage.KEYS.ACHIEVEMENTS, list);
      return true;
    }
    return false;
  },

  /* ---------- Daily challenge ---------- */
  getDaily(dateKey) { return TR.Storage.get(TR.Storage.KEYS.DAILY, {})[dateKey] || null; },
  setDaily(dateKey, data) {
    const all = TR.Storage.get(TR.Storage.KEYS.DAILY, {});
    all[dateKey] = data;
    TR.Storage.set(TR.Storage.KEYS.DAILY, all);
  },

  /* ---------- Counters ---------- */
  getCounters() { return TR.Storage.get(TR.Storage.KEYS.COUNTERS, { races: 0, nitroUsed: 0, maxSpeed: 0, maxCombo: 0 }); },
  addCounter(key, amount) {
    const c = TR.Storage.getCounters();
    c[key] = (c[key] || 0) + amount;
    TR.Storage.set(TR.Storage.KEYS.COUNTERS, c);
    return c;
  }
};
