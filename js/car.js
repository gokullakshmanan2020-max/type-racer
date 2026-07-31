/* ============================================================
 * TYPE RACER - SPEED RUSH
 * car.js — player physics (speed, combo, nitro) + AI opponents
 * Speed changes smoothly; distance = integral of speed.
 * ============================================================ */
window.TR = window.TR || {};

TR.PlayerCar = class PlayerCar {
  constructor() {
    this.phase = 0;   // animation phase accumulator
    this.reset();
  }

  reset() {
    this.speed = TR.Config.BASE_SPEED;
    this.target = TR.Config.BASE_SPEED;
    this.progress = 0;          // meters traveled
    this.topSpeed = TR.Config.BASE_SPEED;
    this.nitroActive = false;
    this.nitroTimer = 0;
    this.nitroCooldown = 0;
    this.nitroCharge = 0;       // 0..100
    this.combo = 0;
    this.maxCombo = 0;
    this.sampleT = 0;           // ghost sampling accumulator
    this.ghostSamples = [];     // [time, progress] for replay
  }

  get speed01() { return (this.speed - TR.Config.MIN_SPEED) / (TR.Config.MAX_SPEED - TR.Config.MIN_SPEED); }

  get nitroReady() { return this.nitroCharge >= 100; }

  /* Correct keystroke: +2 km/h, combo++, nitro charge. Returns milestone or null. */
  onCorrect() {
    this.target = Math.min(TR.Config.MAX_SPEED, this.target + TR.Config.SPEED_PER_CORRECT);
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.nitroCharge = Math.min(100, this.nitroCharge + TR.Config.NITRO_PER_CHAR);
    const m = TR.Config.COMBO_MILESTONES.find((x) => x.at === this.combo);
    if (m) {
      this.target = Math.min(TR.Config.MAX_SPEED, this.target + m.bonus);
      return m;
    }
    return null;
  }

  /* Wrong keystroke: -5 km/h, combo reset */
  onWrong() {
    this.target = Math.max(TR.Config.MIN_SPEED, this.target - TR.Config.SPEED_PER_WRONG);
    this.combo = 0;
  }

  /* Try to activate nitro. Returns true if activated. */
  triggerNitro() {
    if (!this.nitroReady || this.nitroCooldown > 0 || this.nitroActive) return false;
    this.nitroActive = true;
    this.nitroTimer = TR.Config.NITRO_DURATION;
    this.nitroCharge = 0;
    this.target = Math.min(TR.Config.MAX_SPEED, this.target + TR.Config.NITRO_BONUS);
    return true;
  }

  update(dt) {
    /* nitro timing */
    if (this.nitroActive) {
      this.nitroTimer -= dt;
      if (this.nitroTimer <= 0) {
        this.nitroActive = false;
        this.nitroCooldown = TR.Config.NITRO_COOLDOWN;
        this.target = Math.max(TR.Config.MIN_SPEED, this.target - TR.Config.NITRO_BONUS);
      }
    }
    if (this.nitroCooldown > 0) this.nitroCooldown -= dt;

    /* smooth speed toward target */
    const k = 1 - Math.exp(-TR.Config.SPEED_LERP * dt);
    this.speed += (this.target - this.speed) * k;
    this.speed = TR.clamp(this.speed, TR.Config.MIN_SPEED, TR.Config.MAX_SPEED);
    this.topSpeed = Math.max(this.topSpeed, this.speed);

    /* distance traveled (km/h -> m/s) */
    this.progress += (this.speed / 3.6) * dt;
    this.phase += dt * (2 + this.speed * 0.05);
  }

  /* record a ghost sample */
  sample(t) {
    this.ghostSamples.push([t, this.progress]);
    if (this.ghostSamples.length > 600) this.ghostSamples.shift();
  }
};

/* ------------------------------------------------------------------
 * AI opponent — rubber-banded: slows when far ahead, speeds up when
 * the player is ahead, so every race stays close but fair.
 * ------------------------------------------------------------------ */
TR.AICar = class AICar {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.reset();
  }

  reset() {
    this.speed = this.def.base;
    this.progress = 0;
    this.finished = false;
    this.finishTime = 0;
    this.phase = Math.random() * 6.28;
  }

  update(dt, playerProgress, raceTime) {
    if (this.finished) return;
    const diff = playerProgress - this.progress;           // >0 player ahead
    let want = this.def.base * (1 + diff * 0.0022);        // rubber band
    want = TR.clamp(want, this.def.base * 0.55, 150);
    want += Math.sin(raceTime * 0.8 + this.phase) * 5;     // human noise
    this.speed += (want - this.speed) * Math.min(1, dt * 0.4);
    this.progress += (this.speed / 3.6) * dt;
    this.phase += dt * (2 + this.speed * 0.05);
    if (this.progress >= TR.Config.RACE_LENGTH) {
      this.finished = true;
      this.finishTime = raceTime;
    }
  }
};
