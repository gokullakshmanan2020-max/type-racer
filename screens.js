/* ============================================================
 * TYPE RACER - SPEED RUSH
 * screens.js — screen manager: home, results, leaderboard,
 * settings, achievements + toast notifications.
 * ============================================================ */
window.TR = window.TR || {};

TR.Screens = class Screens {
  constructor(app) {
    this.app = app;
    this.screens = {};
    document.querySelectorAll(".screen").forEach((s) => { this.screens[s.id] = s; });
    this.toastBox = document.getElementById("toast-box");
    this._bindHome();
  }

  /* switch to a screen, run its setup hook */
  show(id) {
    for (const k in this.screens) this.screens[k].classList.remove("active");
    const el = this.screens[id];
    if (el) { el.classList.add("active"); if (this["on" + this._cap(id)]) this["on" + this._cap(id)](); }
  }

  _cap(s) { return s.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join(""); }

  /* ---------- home ---------- */
  _bindHome() {
    const app = this.app;
    this._on("btn-start", () => app.startRace("race"));
    this._on("btn-practice", () => app.startRace("practice"));
    this._on("btn-daily", () => app.startRace("daily"));
    this._on("btn-leaderboard", () => this.show("screen-leaderboard"));
    this._on("btn-settings", () => this.show("screen-settings"));
    this._on("btn-achievements", () => this.show("screen-achievements"));
    this._on("btn-multiplayer", () => this.show("screen-multiplayer"));

    /* results screen actions */
    this._on("btn-play-again", () => this._playAgain());
    this._on("btn-home", () => app.goHome());
    this._on("btn-lb", () => this.show("screen-leaderboard"));

    /* back buttons return to home */
    this._on("btn-lb-back", () => app.goHome());
    this._on("btn-settings-back", () => app.goHome());
    this._on("btn-ach-back", () => app.goHome());

    /* multiplayer lobby */
    this._on("mp-create", () => this._mpConnect(() => app.mp.create(TR.Storage.getName())));
    this._on("mp-join", () => this._mpConnect(() => app.mp.join(document.getElementById("mp-code").value, TR.Storage.getName())));
    this._on("mp-start", () => {
      if (app.mp.playerCount < 2) {
        this.toast("Need at least 2 players", "\u{1F6AB}");
        return;
      }
      app.mp.start(TR.Texts.pick(app.settings.difficulty));
    });
    this._on("mp-back", () => app.goHome());
  }

  _mpConnect(action) {
    const app = this.app;
    const status = document.getElementById("mp-status");
    status.textContent = "Connecting\u2026";
    status.classList.add("busy");
    app.mp.connect().then(() => {
      status.classList.remove("busy");
      action();
    }).catch((err) => {
      status.classList.remove("busy");
      status.textContent = "Can't reach the server: " + err.message;
    });
  }

  /* re-render the lobby (players list, room code, host buttons) */
  renderMp() {
    const app = this.app;
    const status = document.getElementById("mp-status");
    const codeEl = document.getElementById("mp-room-code");
    const list = document.getElementById("mp-player-list");
    const start = document.getElementById("mp-start");
    const note = document.getElementById("mp-note");
    if (!app.mp.inRoom) {
      status.textContent = "Create a room or join with a code";
      codeEl.textContent = "";
      list.innerHTML = "";
      start.classList.add("hidden");
      note.textContent = "Share the room code with friends — they join from any PC.";
      return;
    }
    const name = TR.Storage.getName();
    status.textContent = "Room ready \u2014 players: " + app.mp.playerCount + "/4";
    codeEl.textContent = app.mp.room.code;
    list.innerHTML = "";
    app.mp.players.forEach((p) => {
      const row = document.createElement("div");
      row.className = "mp-player" + (p.id === app.mp.youId ? " you" : "");
      row.innerHTML =
        "<span class='mp-dot'></span><span class='mp-name'>" + p.name + (p.id === app.mp.youId ? " (you)" : "") + "</span>" +
        (p.host ? "<span class='mp-host'>HOST</span>" : "") +
        (app.mp.finished.indexOf(p.name) !== -1 ? "<span class='mp-finished'>FINISHED</span>" : "");
      list.appendChild(row);
    });
    start.classList.toggle("hidden", !app.mp.amHost);
    note.textContent = app.mp.amHost
      ? "You are the host \u2014 press START RACE when everyone is in."
      : "Waiting for the host to start the race\u2026";
  }

  _playAgain() {
    const app = this.app;
    if (app.mp.inRoom && app.lastResult && app.lastResult.mode === "online") {
      if (app.mp.amHost) {
        const text = TR.Texts.pick(app.settings.difficulty);
        app.mpText = text;
        app.mp.start(text);
      } else {
        this.toast("Waiting for the host to restart", "\u23F3");
      }
      return;
    }
    app.startRace(app.lastResult ? app.lastResult.mode : "race");
  }

  onScreenHome() {
    /* update daily challenge label with today's date */
    const el = document.getElementById("daily-label");
    const d = new Date();
    const today = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    const rec = TR.Storage.getDaily(today);
    el.textContent = rec ? "Best: " + rec.time.toFixed(1) + "s" : "Ready for today";
  }

  onScreenMultiplayer() {
    this.renderMp();
  }

  _on(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }

  /* ---------- results ---------- */
  onScreenResults() {
    const app = this.app;
    const st = app.lastResult;

    /* title: victory / finish / time trial */
    const title = document.getElementById("res-title");
    title.textContent = st.position === 1 && !st.practice ? "VICTORY" : st.practice ? "TRIAL COMPLETE" : "FINISH";
    title.className = "results-title " + (st.position === 1 ? "win" : "lose");

    const id = document.getElementById("res-position");
    id.textContent = st.practice ? "TIME TRIAL" : st.position + (st.position === 1 ? "ST" : st.position === 2 ? "ND" : st.position === 3 ? "RD" : "TH");
    id.classList.toggle("win", st.position === 1 && !st.practice);
    const set = (i, v) => { document.getElementById(i).textContent = v; };
    set("res-time", st.time.toFixed(1) + "s");
    set("res-top", st.topSpeed + " km/h");
    set("res-avg", st.avgSpeed + " km/h");
    set("res-wpm", st.wpm);
    set("res-acc", st.accuracy + "%");
    set("res-mistakes", st.mistakes);
    set("res-combo", "x" + st.maxCombo);
    set("res-mode", st.modeLabel);

    /* online standings table (hidden for solo races) */
    const online = document.getElementById("res-online");
    const table = document.getElementById("res-online-table");
    if (app.onlineResults && app.onlineResults.length) {
      online.classList.remove("hidden");
      table.innerHTML = "";
      const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
      const myName = TR.Storage.getName();
      app.onlineResults.forEach((r, i) => {
        const tr = document.createElement("tr");
        tr.className = r.name === myName ? "mine" : "";
        tr.innerHTML =
          "<td class='lb-rank'>" + (medals[i] || "#" + (i + 1)) + "</td>" +
          "<td>" + r.name + "</td>" +
          "<td>" + r.time.toFixed(1) + "s</td>" +
          "<td>" + r.wpm + "</td>" +
          "<td>" + r.accuracy + "%</td>";
        table.appendChild(tr);
      });
    } else online.classList.add("hidden");

    /* name editing live-updates the saved leaderboard entry */
    const nameInput = document.getElementById("res-name");
    nameInput.value = TR.Storage.getName();
    nameInput.oninput = () => {
      const name = nameInput.value.trim() || "RACER";
      TR.Storage.setName(name);
      TR.Storage.renameEntry(st.entryId, name);
    };

    /* fireworks on the results backdrop */
    const fxCanvas = document.getElementById("fx-canvas");
    fxCanvas.width = fxCanvas.clientWidth;
    fxCanvas.height = fxCanvas.clientHeight;
    if (st.position === 1 || st.practice) {
      const fctx = fxCanvas.getContext("2d");
      const fx = new TR.Effects(fctx, fxCanvas.clientWidth, fxCanvas.clientHeight);
      let last = 0;
      let firing = 8;
      const iv = setInterval(() => {
        for (let i = 0; i < 3; i++) fx.fireworks(Math.random() * fxCanvas.clientWidth, Math.random() * fxCanvas.clientHeight * 0.6);
        if (--firing <= 0) clearInterval(iv);
      }, 500);
      const start = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
        last = now;
        fx.update(dt, now / 1000);
        fctx.clearRect(0, 0, fxCanvas.clientWidth, fxCanvas.clientHeight);
        fx.render();
        if (now - start < 9000) requestAnimationFrame(loop);
        else fctx.clearRect(0, 0, fxCanvas.clientWidth, fxCanvas.clientHeight);
      };
      requestAnimationFrame(loop);
    }
  }

  /* ---------- leaderboard ---------- */
  onScreenLeaderboard() {
    const tbody = document.getElementById("lb-body");
    const list = TR.Storage.getLeaderboard();
    const name = TR.Storage.getName();
    tbody.innerHTML = "";
    if (!list.length) {
      tbody.innerHTML = "<tr><td colspan='6' class='lb-empty'>No races yet — hit START RACE</td></tr>";
      return;
    }
    const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
    list.forEach((r, i) => {
      const tr = document.createElement("tr");
      const mine = r.name === name ? " mine" : "";
      tr.className = mine;
      tr.innerHTML =
        "<td class='lb-rank'>" + (medals[i] || "#" + (i + 1)) + "</td>" +
        "<td>" + r.name + "</td>" +
        "<td>" + r.wpm + "</td>" +
        "<td>" + r.accuracy + "%</td>" +
        "<td>" + r.time.toFixed(1) + "s</td>" +
        "<td>" + r.topSpeed + "</td>";
      tbody.appendChild(tr);
    });
  }

  /* ---------- settings ---------- */
  onScreenSettings() {
    const s = TR.Storage.getSettings();
    const set = (id, val, fn) => {
      const el = document.getElementById(id);
      if (el) { el.value = val; if (fn) el.addEventListener("change", fn); }
    };
    set("set-difficulty", s.difficulty, (e) => { TR.Storage.setSettings({ difficulty: e.target.value }); });
    set("set-theme", s.theme, (e) => { TR.Storage.setSettings({ theme: e.target.value }); this.app.applySettings(); });
    set("set-skin", s.skin, (e) => { TR.Storage.setSettings({ skin: e.target.value }); this.app.applySettings(); });
    set("set-rain", s.rain, (e) => { TR.Storage.setSettings({ rain: e.target.value }); });
    set("set-night", s.night, (e) => { TR.Storage.setSettings({ night: e.target.value }); this.app.applySettings(); });
    set("set-ghost", s.ghost ? "on" : "off", (e) => { TR.Storage.setSettings({ ghost: e.target.value === "on" }); });
    set("set-sound", s.sound ? "on" : "off", (e) => {
      TR.Storage.setSettings({ sound: e.target.value === "on" });
      this.app.audio.setEnabled(e.target.value === "on");
      if (e.target.value === "on") { this.app.audio.init(); this.app.audio.click(); }
    });
    set("set-engine", s.engine ? "on" : "off", (e) => { TR.Storage.setSettings({ engine: e.target.value === "on" }); });
    set("set-shake", s.shake ? "on" : "off", (e) => { TR.Storage.setSettings({ shake: e.target.value === "on" }); });
    const vol = document.getElementById("set-volume");
    if (vol) {
      vol.value = s.volume * 100;
      vol.oninput = (e) => { TR.Storage.setSettings({ volume: e.target.value / 100 }); this.app.audio.setVolume(e.target.value / 100); };
    }
  }

  /* ---------- achievements ---------- */
  onScreenAchievements() {
    const grid = document.getElementById("ach-grid");
    const unlocked = TR.Storage.getAchievements();
    const counters = TR.Storage.getCounters();
    grid.innerHTML = "";
    TR.Config.ACHIEVEMENTS.forEach((a) => {
      const card = document.createElement("div");
      card.className = "ach " + (unlocked[a.id] ? "unlocked" : "locked");
      card.innerHTML =
        "<div class='ach-icon'>" + a.icon + "</div>" +
        "<div class='ach-name'>" + a.name + "</div>" +
        "<div class='ach-desc'>" + a.desc + "</div>" +
        "<div class='ach-date'>" + (unlocked[a.id] ? "Unlocked " + new Date(unlocked[a.id]).toLocaleDateString() : "Locked") + "</div>";
      grid.appendChild(card);
    });
    /* small progress footer */
    document.getElementById("ach-stats").textContent =
      unlockedCount() + "/" + TR.Config.ACHIEVEMENTS.length + " unlocked \u00B7 " + counters.races + " races \u00B7 " + counters.nitroUsed + " nitros";
    function unlockedCount() { return Object.keys(TR.Storage.getAchievements()).length; }
  }

  /* ---------- toasts ---------- */
  toast(msg, icon) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = "<span class='toast-icon'>" + (icon || "\u26A1") + "</span><span>" + msg + "</span>";
    this.toastBox.appendChild(el);
    while (this.toastBox.children.length > 4) this.toastBox.removeChild(this.toastBox.firstChild);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 2600);
  }
};
