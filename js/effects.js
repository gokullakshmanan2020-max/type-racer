/* ============================================================
 * TYPE RACER - SPEED RUSH
 * effects.js — particle system (dust, smoke, nitro flames,
 * fireworks) + rain overlay. Rendered on the track canvas.
 * ============================================================ */
window.TR = window.TR || {};

TR.Effects = class Effects {
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.particles = [];
    this.rain = [];
    this.rainOn = false;
  }

  resize(w, h) { this.width = w; this.height = h; }

  /* ---------- spawners ---------- */

  dust(x, y, dir, amt) {
    for (let i = 0; i < amt; i++) {
      this._add({
        x, y: y + Math.random() * 6 - 3,
        vx: -dir * (20 + Math.random() * 40),
        vy: -(5 + Math.random() * 18),
        life: 0, maxLife: 0.5 + Math.random() * 0.4,
        size: 2 + Math.random() * 3.5,
        color: "rgba(150,150,180,", fade: true
      });
    }
  }

  smoke(x, y) {
    for (let i = 0; i < 14; i++) {
      this._add({
        x: x + Math.random() * 14 - 7,
        y: y + Math.random() * 10 - 5,
        vx: Math.random() * 30 - 15,
        vy: -(30 + Math.random() * 40),
        life: 0, maxLife: 0.7 + Math.random() * 0.5,
        size: 5 + Math.random() * 7,
        color: "rgba(255,80,60,", fade: true,
        grow: 1.6
      });
    }
  }

  flames(x, y) {
    /* additive blue jet — nitro exhaust */
    for (let i = 0; i < 5; i++) {
      this._add({
        x, y: y + Math.random() * 4 - 2,
        vx: -(250 + Math.random() * 140),
        vy: Math.random() * 20 - 10,
        life: 0, maxLife: 0.18 + Math.random() * 0.12,
        size: 4 + Math.random() * 6,
        color: Math.random() < 0.5 ? "rgba(56,242,255," : "rgba(120,120,255,",
        fade: true, glow: true
      });
    }
  }

  fireworks(x, y) {
    const hue = Math.random() * 360;
    const colors = [`hsla(${hue},100%,65%,`, `hsla(${(hue + 40) % 360},100%,70%,`, `hsla(${(hue + 200) % 360},100%,60%,`];
    for (let i = 0; i < 46; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this._add({
        x, y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0, maxLife: 0.9 + Math.random() * 0.7,
        size: 1.5 + Math.random() * 2.5,
        color: colors[i % 3], fade: true, glow: true, grav: 30
      });
    }
  }

  _add(p) { if (this.particles.length < 500) this.particles.push(p); }

  /* ---------- rain ---------- */

  setRain(on) {
    this.rainOn = on;
    if (on && this.rain.length < 160) {
      for (let i = this.rain.length; i < 160; i++) {
        this.rain.push({ x: Math.random() * this.width, y: Math.random() * this.height, v: 500 + Math.random() * 300 });
      }
    }
  }

  /* ---------- main loop ---------- */

  update(dt, t) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.maxLife) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += p.grav * dt;
      if (p.grow) p.size += p.grow * dt * 8;
    }
    if (this.rainOn) {
      for (const d of this.rain) {
        d.y += d.v * dt;
        d.x -= d.v * 0.18 * dt;
        if (d.y > this.height + 10) { d.y = -10; d.x = Math.random() * this.width; }
      }
    }
  }

  render() {
    const ctx = this.ctx;
    /* normal particles (dust / smoke) */
    for (const p of this.particles) {
      if (p.glow) continue;
      const a = (1 - p.life / p.maxLife) * 0.6;
      ctx.fillStyle = p.color + a + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    /* glow particles (flames / fireworks) — additive */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      if (!p.glow) continue;
      const a = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color + a + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + p.life * 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    /* rain */
    if (this.rainOn) {
      ctx.save();
      ctx.strokeStyle = "rgba(160,200,255,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.rain) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 6, d.y - 14);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  clear() { this.particles.length = 0; }
};
