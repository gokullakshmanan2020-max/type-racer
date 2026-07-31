/* ============================================================
 * TYPE RACER - SPEED RUSH
 * main.js — App bootstrap: input handling, race state machine,
 * game loop, achievements, ghost replay, results.
 * ============================================================ */
window.TR = window.TR || {};

TR.App = class App {
  constructor() {
    this.canvas = document.getElementById("track-canvas");
    this.track = new TR.TrackRenderer(this.canvas);
    this.effects = new TR.Effects(this.canvas.getContext("2d"), this.canvas.clientWidth, this.canvas.clientHeight);
    this.audio = new TR.AudioEngine();
    this.hud = new TR.HUD(document.getElementById("screen-game"));
    this.screens = new TR.Screens(this);

    this.player = new TR.PlayerCar();
    this.ai = [];
    this.mp = new TR.Multiplayer(this);
    this.typing = null;
    this.phase = "menu";           // menu | countdown | racing | finished
    this.mode = "race";
    this.time = 0;                 // race clock
    this.countT = 0;
    this.ghost = null;             // ghost sample data
    this.ghostProgress = null;     // current ghost position
    this.ghostAt = null;
    this.sampleT = 0;
    this.dustT = 0;
    this.world = { theme: "neon", skin: TR.Config.SKINS[0], night: true, rain: false, ai: [], practice: false };
    this.lastResult = null;
    this.lastNow = performance.now();

    this.applySettings();
    this._bindEvents();
    this._startMenu();
    requestAnimationFrame((t) => this._loop(t));
  }

  /* ---------------- settings ---------------- */

  applySettings() {
    const s = TR.Storage.getSettings();
    this.settings = s;
    this.audio.setEnabled(s.sound);
    this.audio.setVolume(s.volume);
    const skin = TR.Config.SKINS.find((k) => k.id === s.skin) || TR.Config.SKINS[0];
    this.world.theme = s.theme;
    this.world.skin = skin;
    this.world.night = s.night === "on" || (s.night === "auto" && Math.random() < 0.5);
    this.effects.setRain(s.rain === "on" || (s.rain === "auto" && Math.random() < 0.4));
  }

  /* ---------------- race lifecycle ---------------- */

  /* mode: 'race' (vs AI) | 'practice' (time trial) | 'daily' */
  startRace(mode) {
    this.audio.init();
    this.audio.idleStop();
    this.mode = mode;
    const s = this.settings;

    /* pick text: online uses the server-chosen text; daily uses date-seeded pool */
    let text, difficulty;
    if (mode === "online") {
      text = this.mpText || TR.Texts.pick("medium");
      difficulty = "online";
    } else if (mode === "daily") {
      const d = new Date();
      const seed = (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
      text = TR.Texts.pick("daily", seed);
      difficulty = "daily";
    } else {
      difficulty = s.difficulty;
      text = TR.Texts.pick(difficulty);
    }
    this.typing = new TR.TypingEngine(text);
    this.player.reset();
    this.ai = [];
    if (mode === "race") {
      this.ai = TR.Config.AI_CARS.map((def, i) => new TR.AICar(def, i));
    }

    /* ghost replay of best previous run on this text (not online) */
    this.ghost = null;
    this.ghostProgress = null;
    this.ghostAt = null;
    if (s.ghost && mode !== "online") {
      const g = TR.Storage.getGhost(text);
      if (g && g.samples.length > 1) { this.ghost = g; this.ghostAt = g.samples[0][0]; }
    }

    /* weather reroll on each race */
    this.world.night = s.night === "on" || (s.night === "auto" && Math.random() < 0.5);
    this.effects.setRain(s.rain === "on" || (s.rain === "auto" && Math.random() < 0.4));

    this.effects.clear();
    this.time = 0;
    this.sampleT = 0;
    this.dustT = 0;
    this.phase = "countdown";
    this.countT = 3.6;
    document.getElementById("hud-mode").textContent = mode === "daily" ? "DAILY" : mode === "practice" ? "TRIAL" : mode === "online" ? "ONLINE" : "RACE";
    this._buildText();
    this.screens.show("screen-game");
    this._setTrackBlur(false);
    this._shake(false);
    this.hud.hideCount();
    if (s.engine) this.audio.engineStart();
  }

  finish() {
    this.phase = "finished";
    this.audio.engineStop();
    if (this.mode === "online") {
      /* server tallies everyone's results; wait for the standings */
      this.mp.finish({
        time: this.time,
        wpm: this.typing.finalWpm(this.time),
        accuracy: this.typing.accuracy(),
        mistakes: this.typing.wrong
      });
      this.screens.toast("FINISHED \u2014 waiting for others\u2026", "\u{1F3C1}");
      return;
    }
    const t = this.typing;
    const p = this.player;

    /* position: 1 + AI already finished + AI ahead on track */
    let position = 1;
    if (this.mode === "race") {
      for (const ai of this.ai) {
        if (ai.finished || ai.progress >= p.progress) position++;
      }
    }
    const isPractice = this.mode === "practice";
    this.audio.finish(position === 1 && !isPractice);

    /* fireworks */
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.effects.fireworks(Math.random() * this.canvas.clientWidth, Math.random() * this.canvas.clientHeight * 0.5), i * 180);
    }

    const time = this.time;
    const stats = {
      position, practice: isPractice,
      time,
      topSpeed: Math.round(p.topSpeed),
      avgSpeed: Math.round(time > 0 ? (p.progress / time) * 3.6 : 0),
      wpm: t.finalWpm(time),
      accuracy: t.accuracy(),
      mistakes: t.wrong,
      maxCombo: p.maxCombo,
      modeLabel: this.mode === "daily" ? "Daily Challenge" : isPractice ? "Practice" : "Race",
      mode: this.mode
    };

    /* leaderboard entry (auto-saved; name editable on results screen) */
    if (t.correct > 0) {
      const saved = TR.Storage.addScore({
        name: TR.Storage.getName(),
        wpm: stats.wpm, accuracy: stats.accuracy,
        time: stats.time, topSpeed: stats.topSpeed,
        date: new Date().toISOString(),
        mode: stats.modeLabel,
        position: isPractice ? null : stats.position
      });
      stats.entryId = saved.id;
      if (saved.rank === 1) this.screens.toast("NEW #1 ON THE LEADERBOARD!", "\u{1F3C6}");
      else if (saved.rank <= 10) this.screens.toast("Leaderboard entry #" + saved.rank, "\u{1F3C6}");
    }

    /* ghost replay: keep the best run per text */
    if (this.ghost) {
      if (p.ghostSamples.length > 2) TR.Storage.saveGhost(this.typing.text, p.ghostSamples, time);
    }

    /* counters + achievements */
    const c = TR.Storage.addCounter("races", 1);
    this._checkAchievements(stats, c);

    this.lastResult = stats;
    setTimeout(() => this.screens.show("screen-results"), 1800);
  }

  _checkAchievements(st, c) {
    const unlock = (id, msg, icon) => {
      if (TR.Storage.unlock(id)) this.screens.toast(msg, icon);
    };
    unlock("first_race", "Achievement: First Race", "\u{1F3C1}");
    if (st.topSpeed >= 150) unlock("speed150", "Achievement: Speed Demon", "\u{1F680}");
    if (st.topSpeed >= 220) unlock("speed220", "Achievement: Velocity Max", "\u26A1");
    if (st.maxCombo >= 30) unlock("combo30", "Achievement: Combo Master", "\u{1F525}");
    if (c.nitroUsed >= 1) unlock("nitro", "Achievement: Nitro Junkie", "\u{1F4A8}");
    if (st.accuracy === 100 && st.mistakes === 0) unlock("flawless", "Achievement: Flawless", "\u{1F4AF}");
    if (this.mode === "hard") unlock("coder", "Achievement: Code Runner", "\u{1F4BB}");
    if (c.races >= 5) unlock("five_races", "Achievement: Marathon", "\u{1F3C3}");
    if (this.mode === "daily") {
      const d = new Date();
      const key = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
      TR.Storage.setDaily(key, { time: st.time, wpm: st.wpm });
      unlock("daily", "Achievement: Daily Grind", "\u{1F4C5}");
    }
    if (st.position === 1 && !st.practice) unlock("winner", "Achievement: Champion", "\u{1F947}");
  }

  goHome() {
    if (this.mp.inRoom) this.mp.leave();
    this.audio.engineStop();
    this.audio.idleStart();
    this._startMenu();
    this.screens.show("screen-home");
  }

  _startMenu() {
    /* attract mode: car cruises the track behind the home screen */
    this.phase = "menu";
    this.player.reset();
    this.player.speed = 78;
    this.player.target = 78;
    this.ai = TR.Config.AI_CARS.map((def, i) => new TR.AICar(def, i));
    this.ai.forEach((a, i) => { a.progress = i * 150; a.speed = 60; });
    this.world.practice = true;
  }

  /* ---------------- input ---------------- */

  _bindEvents() {
    /* audio requires a user gesture */
    const unlockAudio = () => { this.audio.init(); if (this.phase === "menu" && this.settings.sound) this.audio.idleStart(); };
    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });

    window.addEventListener("keydown", (e) => this._onKey(e));
    window.addEventListener("resize", () => {
      this.track.resize();
      this.effects.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.audio.engineStop();
    });
    /* mobile: tapping the typing panel summons the soft keyboard */
    const mi = document.getElementById("mobile-input");
    document.getElementById("typing-panel").addEventListener("pointerdown", () => {
      if (this.phase === "racing") mi.focus();
    });
    this.hud.el.countdown.parentElement.addEventListener("pointerdown", () => {
      if (this.phase === "racing") mi.focus();
    });
  }

  _onKey(e) {
    const phase = this.phase;
    const key = e.key;

    if (phase === "countdown" || phase === "racing") {
      e.preventDefault(); // stop space scrolling / tab focus
    }
    if (phase === "finished") return;

    if (key === "Escape" && phase !== "menu") { this.goHome(); return; }

    if (phase !== "racing") return;

    /* nitro on SPACE — unless the next char to type is a space */
    if (key === " " && this.player.nitroReady && !this.player.nitroActive && this.typing.currentChar !== " ") {
      this._activateNitro();
      return;
    }

    /* printable single characters only */
    if (key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

    const res = this.typing.press(key);
    if (res === "correct") {
      this.audio.click();
      const p = this.player;
      const mile = p.onCorrect();
      if (mile) {
        this.audio.milestone(mile.tier);
        this.screens.toast("COMBO x" + mile.at + " \u2014 " + mile.label + " +" + mile.bonus + " km/h", ["\u26A1", "\u{1F680}", "\u{1F525}", "\u{1F3C1}"][mile.tier - 1]);
      }
    } else {
      this.audio.wrong();
      this.player.onWrong();
      if (this.settings.shake) this._shake(true);
      const cx = this.canvas.clientWidth * 0.26;
      const cy = this.canvas.clientHeight * 0.68;
      this.effects.smoke(cx + 10, cy);
    }
    this._renderText();
  }

  _activateNitro() {
    if (!this.player.triggerNitro()) return;
    this.audio.nitro();
    this.audio.engineUpdate(this.player.speed01, true);
    this.screens.toast("NITRO ENGAGED +40 km/h", "\u{1F4A8}");
    TR.Storage.addCounter("nitroUsed", 1);
    this._setTrackBlur(true);
    if (this.settings.shake) this._shake(true);
  }

  /* ---------------- typing text DOM ---------------- */

  _buildText() {
    const box = document.getElementById("typing-text");
    box.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < this.typing.text.length; i++) {
      const span = document.createElement("span");
      /* plain spaces (NOT nbsp) so long paragraphs wrap inside the box */
      span.textContent = this.typing.text[i];
      span.className = "ch";
      if (i === 0) span.classList.add("caret");
      frag.appendChild(span);
    }
    box.appendChild(frag);
    this.chars = box.children;
    this._renderText();
  }

  /* color characters: done = ok, current = caret, wrong = red flash */
  _renderText() {
    if (!this.chars) return;
    const t = this.typing;
    for (let i = 0; i < this.chars.length; i++) {
      const c = this.chars[i];
      c.classList.remove("ok", "caret", "wrong");
      if (i < t.caret) c.classList.add("ok");
      else if (i === t.caret) {
        c.classList.add("caret");
        if (t.wrongNow) c.classList.add("wrong");
      }
    }
    /* keep the caret visible */
    const caret = this.chars[t.caret];
    if (caret) {
      const box = document.getElementById("typing-text");
      const top = caret.offsetTop, bot = top + caret.offsetHeight;
      if (top < box.scrollTop) box.scrollTop = top - 6;
      else if (bot > box.scrollTop + box.clientHeight) box.scrollTop = bot - box.clientHeight + 6;
    }
  }

  /* ---------------- visual helpers ---------------- */

  _shake(on) {
    const el = document.getElementById("track-wrap");
    if (on) {
      el.classList.remove("shake");
      void el.offsetWidth;
      el.classList.add("shake");
    } else el.classList.remove("shake");
  }

  _setTrackBlur(on) {
    document.getElementById("track-wrap").classList.toggle("nitro-blur", on);
  }

  /* ---------------- game loop ---------------- */

  _loop(now) {
    const dt = Math.min(0.033, (now - this.lastNow) / 1000);
    this.lastNow = now;
    this.t = now / 1000;

    if (this.phase === "countdown") this._updateCountdown(dt);
    else if (this.phase === "racing") this._updateRacing(dt);
    else if (this.phase === "menu") this._updateMenu(dt);

    this.effects.update(dt, this.t);
    this._render(dt);
    requestAnimationFrame((t) => this._loop(t));
  }

  _updateCountdown(dt) {
    this.countT -= dt;
    const c = this.countT;
    if (!this._c3 && c <= 3.0) { this._c3 = true; this.hud.showCount("3"); this.audio.countBeep(false); }
    if (!this._c2 && c <= 2.0) { this._c2 = true; this.hud.showCount("2"); this.audio.countBeep(false); }
    if (!this._c1 && c <= 1.0) { this._c1 = true; this.hud.showCount("1"); this.audio.countBeep(false); }
    if (!this._cgo && c <= 0.0) { this._cgo = true; this.hud.showCount("GO!"); this.audio.countBeep(true); }
    if (c <= -0.9) {
      this.hud.hideCount();
      this.phase = "racing";
      this._c3 = this._c2 = this._c1 = this._cgo = false;
      const mi = document.getElementById("mobile-input");
      if (window.matchMedia("(pointer: coarse)").matches) mi.focus();
    }
    /* car idles at the line during countdown */
    this.player.speed = TR.Config.BASE_SPEED;
    if (this.settings.engine) this.audio.engineUpdate(0.2, false);
    this.effects.dust(this.canvas.clientWidth * 0.26 + 40, this.canvas.clientHeight * 0.7, 1, 1);
  }

  _updateRacing(dt) {
    this.time += dt;
    const p = this.player;
    p.update(dt);
    this.player.sampleT += dt;
    if (this.player.sampleT >= 0.5) { this.player.sampleT = 0; p.sample(this.time); }

    /* AI + ghost (online: remote players instead) */
    if (this.mode === "online") {
      this.world.ai = this.mp.cars();
      this.mp.tick(dt);
    } else {
      this.world.ai = this.ai.map((a) => {
        a.update(dt, p.progress, this.time);
        return { progress: a.progress, color: a.def.color, accent: a.def.accent, phase: a.phase, finished: a.finished };
      });
    }
    if (this.ghost) this.ghostProgress = this._ghostAt(this.time);

    /* engine sound follows speed */
    if (this.settings.engine) this.audio.engineUpdate(p.speed01, p.nitroActive);

    /* wheel dust */
    this.dustT -= dt;
    const wheelX = this.canvas.clientWidth * 0.26 + 40;
    const wheelY = this.canvas.clientHeight * 0.7;
    if (this.dustT <= 0) {
      this.dustT = Math.max(0.03, 0.18 - p.speed01 * 0.12);
      this.effects.dust(wheelX, wheelY, 1, p.nitroActive ? 3 : 2);
      for (const a of this.ai) {
        const ax = wheelX + (a.progress - p.progress) * TR.Config.PX_PER_METER;
        if (ax > -50 && ax < this.canvas.clientWidth + 50) this.effects.dust(ax + 20, wheelY, 1, 1);
      }
    }
    /* nitro flames */
    if (p.nitroActive) this.effects.flames(wheelX - 80, wheelY - 24);

    /* finish check */
    if (p.progress >= TR.Config.RACE_LENGTH) { p.progress = TR.Config.RACE_LENGTH; this.finish(); }
  }

  _updateMenu(dt) {
    const p = this.player;
    p.update(dt);
    if (p.progress >= TR.Config.RACE_LENGTH) p.progress = 0;
    this.world.ai = this.ai.map((a) => {
      a.update(dt, p.progress, this.t);
      if (a.progress >= TR.Config.RACE_LENGTH) a.progress = 0;
      return { progress: a.progress, color: a.def.color, accent: a.def.accent, phase: a.phase, finished: a.finished };
    });
  }

  /* interpolate ghost position at race time */
  _ghostAt(t) {
    const s = this.ghost.samples;
    if (t <= s[0][0]) return s[0][1];
    if (t >= s[s.length - 1][0]) return s[s.length - 1][1];
    for (let i = 1; i < s.length; i++) {
      if (t <= s[i][0]) {
        const a = s[i - 1], b = s[i];
        const k = (t - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return s[s.length - 1][1];
  }

  _render() {
    const p = this.player;
    const world = this.world;
    world.t = this.t;
    world.progress = p.progress;
    world.speed01 = p.speed01;
    world.nitro = p.nitroActive;
    world.playerPhase = p.phase;
    world.practice = this.mode === "practice" || this.phase === "menu";
    world.ghost = this.ghost ? this.ghostProgress : null;
    this.track.render(world);
    this.effects.render();

    if (this.phase === "racing" || this.phase === "finished") {
      const pos = this.mode === "race" ? this._position() : this.mode === "online" ? this.mp.position(p.progress) : 0;
      this.hud.update({
        speed: p.speed, wpm: this.typing.liveWpm(performance.now()),
        accuracy: this.typing.accuracy(), mistakes: this.typing.wrong,
        combo: p.combo, nitroCharge: p.nitroCharge, nitroReady: p.nitroReady,
        nitroCd: p.nitroCooldown, progress: p.progress, position: pos,
        time: this.time, practice: this.mode === "practice"
      });
    }
  }

  _position() {
    let pos = 1;
    for (const a of this.ai) if (a.finished || a.progress >= this.player.progress) pos++;
    return pos;
  }

  /* ---------------- multiplayer callbacks ---------------- */

  onMpJoined(m) {
    this.screens.renderMp();
  }

  onMpPlayers() {
    this.screens.renderMp();
  }

  onMpStarting(text) {
    this.mpText = text;
    this.startRace("online");
  }

  onMpPlayerFinished(name, m) {
    this.screens.toast(name + " finished \u2014 " + m.wpm + " WPM", "\u{1F3C1}");
  }

  onMpResults(results) {
    const idx = results.findIndex((r) => r.id === this.mp.youId);
    const my = results[idx] || results[0];
    const isWin = results.length > 1 ? idx === 0 : true;
    const t = this.typing;
    const p = this.player;
    const st = {
      position: idx + 1,
      practice: false,
      time: my.time,
      topSpeed: Math.round(p.topSpeed),
      avgSpeed: Math.round(p.progress / (my.time || 1) * 3.6),
      wpm: my.wpm,
      accuracy: my.accuracy,
      mistakes: my.mistakes,
      maxCombo: p.maxCombo,
      modeLabel: "Online Race",
      mode: "online",
      entryId: null
    };
    if (t.correct > 0) {
      const saved = TR.Storage.addScore({
        name: TR.Storage.getName(),
        wpm: st.wpm, accuracy: st.accuracy,
        time: st.time, topSpeed: st.topSpeed,
        date: new Date().toISOString(),
        mode: "Online",
        position: st.position
      });
      st.entryId = saved.id;
      if (saved.rank === 1) this.screens.toast("NEW #1 ON THE LEADERBOARD!", "\u{1F3C6}");
    }
    const c = TR.Storage.addCounter("races", 1);
    this._checkAchievements(st, c);
    this.lastResult = st;
    this.onlineResults = results.map((r) => ({ name: r.name, time: r.time, wpm: r.wpm, accuracy: r.accuracy }));
    if (isWin) {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => this.effects.fireworks(Math.random() * this.canvas.clientWidth, Math.random() * this.canvas.clientHeight * 0.5), i * 180);
      }
      this.audio.finish(true);
    } else this.audio.finish(false);
    this.screens.show("screen-results");
  }

  onMpError(msg) {
    this.screens.toast(msg, "\u26A0");
    this.screens.renderMp();
  }

  onMpClosed() {
    this.screens.toast("Disconnected from the game server", "\u{1F6AB}");
    this._startMenu();
    this.screens.show("screen-multiplayer");
  }
};

/* boot */
document.addEventListener("DOMContentLoaded", () => {
  window.TRApp = new TR.App();
});
