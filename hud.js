/* ============================================================
 * TYPE RACER - SPEED RUSH
 * hud.js — HUD updates: speedometer, WPM, accuracy, mistakes,
 * combo badge, nitro bar, progress bar, timer, position.
 * ============================================================ */
window.TR = window.TR || {};

TR.HUD = class HUD {
  constructor(root) {
    this.q = (id) => root.querySelector("#" + id);
    this.el = {
      time: this.q("hud-time"),
      position: this.q("hud-position"),
      wpm: this.q("hud-wpm"),
      acc: this.q("hud-acc"),
      mistakes: this.q("hud-mistakes"),
      combo: this.q("hud-combo"),
      comboBox: this.q("combo-box"),
      needle: this.q("speedo-needle"),
      speed: this.q("speedo-value"),
      ring: this.q("speedo-ring"),
      progress: this.q("hud-progress"),
      nitro: this.q("nitro-fill"),
      nitroBox: this.q("nitro-box"),
      nitroHint: this.q("nitro-hint"),
      countdown: this.q("countdown")
    };
    this.lastText = 0;   // throttle for text stats
    this.t = 0;
  }

  /* called every frame with the live race snapshot */
  update(world) {
    this.t += 1 / 60;
    const el = this.el;

    /* speedometer — every frame for smooth needle */
    const speed = Math.round(world.speed);
    const angle = -120 + TR.clamp(speed / 240, 0, 1) * 240;
    el.needle.style.transform = "rotate(" + angle + "deg)";
    el.speed.textContent = speed;
    const arc = (120 + angle) + "deg";
    el.ring.style.background = "conic-gradient(" +
      (world.nitro ? "var(--neon-blue)" : "var(--neon-cyan)") + " 0deg " + arc + "," +
      "rgba(255,255,255,0.06) " + arc + " 360deg)";
    if (world.nitro) {
      el.speed.style.color = "var(--neon-blue)";
      el.speed.style.textShadow = "0 0 18px var(--neon-blue)";
    } else {
      el.speed.style.color = "";
      el.speed.style.textShadow = "";
    }

    /* text stats — throttled to ~10 Hz */
    if (this.t - this.lastText > 0.1) {
      this.lastText = this.t;
      el.wpm.textContent = world.wpm;
      el.acc.textContent = world.accuracy + "%";
      el.mistakes.textContent = world.mistakes;
      el.time.textContent = this._fmtTime(world.time);
      el.position.textContent = world.practice ? "TIME TRIAL" : "#" + world.position;

      /* combo badge */
      el.comboBox.classList.toggle("active", world.combo >= 2);
      el.comboBox.classList.toggle("tier1", world.combo >= 5);
      el.comboBox.classList.toggle("tier2", world.combo >= 10);
      el.comboBox.classList.toggle("tier3", world.combo >= 20);
      el.comboBox.classList.toggle("tier4", world.combo >= 30);
      el.combo.textContent = "x" + world.combo;

      /* progress + nitro bars */
      el.progress.style.width = TR.clamp(world.progress / TR.Config.RACE_LENGTH, 0, 1) * 100 + "%";
      el.nitro.style.width = world.nitroCharge + "%";
      el.nitroBox.classList.toggle("ready", world.nitroReady && !world.nitroActive);
      el.nitroBox.classList.toggle("cooling", world.nitroCd > 0);
      el.nitroHint.style.display = (world.nitroReady && !world.nitroActive) ? "block" : "none";
      el.nitroHint.textContent = "PRESS SPACE";
    }
  }

  /* countdown overlay: 3 / 2 / 1 / GO! */
  showCount(value) {
    const el = this.el.countdown;
    el.textContent = value;
    el.classList.remove("show");
    void el.offsetWidth;               // restart CSS animation
    el.classList.add("show");
    el.classList.toggle("go", value === "GO!");
  }

  hideCount() {
    this.el.countdown.classList.remove("show");
  }

  _fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
};
