/* ============================================================
 * TYPE RACER - SPEED RUSH
 * track.js — canvas track renderer (parallax city, road, cars,
 * weather, speed lines). Draws from a plain `world` object so
 * it stays decoupled from game logic.
 * ============================================================ */
window.TR = window.TR || {};

TR.TrackRenderer = class TrackRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.w = 0;
    this.h = 0;
    this.stars = [];
    this.resize();
  }

  /* handle DPR scaling + window resize */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* regenerate starfield */
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.4, tw: Math.random() * 6.28 });
    }
  }

  /* deterministic hash -> [0,1) */
  _h(n) { return TR.rand(n * 7919 + 13)(); }

  /* ---------- main render ---------- */
  render(world) {
    const ctx = this.ctx;
    const { w, h } = this;
    const theme = TR.Config.THEMES[world.theme];
    const ppm = TR.Config.PX_PER_METER;
    const roadY = h * 0.62;
    const roadH = h * 0.17;
    const wheelY = roadY + roadH * 0.62;      // car wheel baseline
    const carX = w * 0.26;                    // player car screen x

    /* sky */
    const grad = ctx.createLinearGradient(0, 0, 0, roadY);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, roadY);

    /* sun / moon */
    if (theme.night) {
      ctx.save();
      ctx.fillStyle = "#e8f6ff";
      ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 26;
      ctx.beginPath(); ctx.arc(w * 0.82, h * 0.16, 20, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      /* stars */
      for (const s of this.stars) {
        ctx.globalAlpha = 0.35 + 0.4 * Math.sin(world.t * 1.4 + s.tw);
        ctx.fillStyle = "#cfeaff";
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h * 0.55, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.save();
      ctx.fillStyle = "#ffe9a8";
      ctx.shadowColor = "#ff9f1c"; ctx.shadowBlur = 60;
      ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, 34, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    /* parallax skyline + buildings */
    const off = carX - world.progress * ppm * 0.55;
    const step = 72;
    for (let i = Math.floor(off / step) - 1; i < Math.ceil((off + w) / step) + 1; i++) {
      const bx = off - i * step;
      const bh = 40 + this._h(i) * h * 0.22;
      const bw = 46 + this._h(i * 3 + 1) * 34;
      ctx.fillStyle = theme.night ? "rgba(8,10,32,0.85)" : "rgba(40,20,60,0.7)";
      ctx.fillRect(bx, roadY - bh - 14, bw, bh + 14);
      /* neon windows */
      if (theme.night) {
        for (let wy = 0; wy < Math.floor(bh / 16); wy++) {
          for (let wx = 0; wx < 3; wx++) {
            if (this._h(i * 17 + wy * 3 + wx) < 0.45) {
              ctx.fillStyle = ["#38f2ff", "#ff2d78", "#ffd166", "#39ff14"][Math.floor(this._h(i * 31 + wy) * 4)];
              ctx.globalAlpha = 0.7;
              ctx.fillRect(bx + 8 + wx * 14, roadY - bh - 6 + wy * 17, 7, 8);
            }
          }
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "rgba(255,214,150,0.25)";
        ctx.fillRect(bx + 6, roadY - bh + 10, 6, 6);
        ctx.fillRect(bx + bw - 14, roadY - bh + 30, 6, 6);
      }
    }

    /* road */
    ctx.fillStyle = theme.road;
    ctx.fillRect(0, roadY, w, roadH);
    ctx.fillStyle = theme.line;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, roadY, w, 2);                    // top edge glow
    ctx.fillRect(0, roadY + roadH - 2, w, 2);        // bottom edge glow
    ctx.globalAlpha = 1;

    /* center dashed lane — scrolls with progress */
    const dashWorld = 26;
    const offDash = -(world.progress * ppm) % (dashWorld * ppm);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let x = offDash; x < w + dashWorld * ppm; x += dashWorld * ppm) {
      ctx.fillRect(x, roadY + roadH * 0.5 - 2.5, 14, 5);
    }

    /* ground strip below road */
    ctx.fillStyle = theme.night ? "#070914" : "#1d1526";
    ctx.fillRect(0, roadY + roadH, w, h - roadY - roadH);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    const gStep = 36;
    const offG = -(world.progress * ppm) % gStep;
    for (let x = offG; x < w + gStep; x += gStep) ctx.fillRect(x, roadY + roadH + 4, 10, 2);

    /* start / finish lines */
    this._line(ctx, carX - world.progress * ppm, roadY, roadH, "start");
    this._line(ctx, carX + (TR.Config.RACE_LENGTH - world.progress) * ppm, roadY, roadH, "finish");

    /* distance markers */
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = "10px Consolas, monospace";
    ctx.textAlign = "center";
    const mkStep = 100;
    for (let m = mkStep; m < TR.Config.RACE_LENGTH; m += mkStep) {
      const x = carX + (m - world.progress) * ppm;
      if (x > 0 && x < w) ctx.fillText((m / 100) + "00m", x, roadY + roadH - 6);
    }

    /* ---- cars (ghost behind, AI, then player on top) ---- */
    const carScale = Math.min(1, w / 900) * 1.15;

    if (world.ghost !== null && world.ghost !== undefined) {
      const gx = carX + (world.ghost - world.progress) * ppm;
      if (gx > -120 && gx < w + 120) {
        this._car(ctx, gx, wheelY, { body: "#aeb8c9", accent: "#ffffff", scale: carScale, ghost: true });
      }
    }
    for (const ai of world.ai) {
      const ax = carX + (ai.progress - world.progress) * ppm;
      if (ax > -140 && ax < w + 140) {
        this._car(ctx, ax, wheelY, {
          body: ai.color, accent: ai.accent, scale: carScale * 0.92,
          wheel: ai.phase * 3, bob: Math.sin(ai.phase) * 1.6, night: theme.night
        });
      }
    }
    /* player */
    this._car(ctx, carX, wheelY, {
      body: world.skin.color, accent: world.skin.accent, scale: carScale,
      wheel: world.playerPhase * 3, bob: Math.sin(world.playerPhase) * 1.6,
      nitro: world.nitro, night: theme.night, under: true
    });

    /* speed lines at high velocity */
    if (world.speed01 > 0.68 || world.nitro) {
      ctx.save();
      ctx.strokeStyle = "rgba(160,220,255,0.10)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const ly = Math.random() * h;
        const lx = Math.random() * w;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - 60 - world.speed01 * 90, ly);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* checkered start/finish banner */
  _line(ctx, x, roadY, roadH, kind) {
    if (x < -60 || x > this.w + 60) return;
    const stripH = roadH * 0.55;
    ctx.fillStyle = kind === "finish" ? "#f5f5f5" : "#ffffff";
    ctx.fillRect(x, roadY + 4, 40, stripH);
    ctx.fillStyle = kind === "finish" ? "#101010" : "#222222";
    for (let r = 0; r < Math.floor(stripH / 12); r++) {
      for (let c = 0; c < 3; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(x + c * 13 + 1, roadY + 4 + r * 12 + 1, 12, 10);
      }
    }
    if (kind === "finish") {
      ctx.save();
      ctx.fillStyle = "#ff2d78";
      ctx.font = "bold 11px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff2d78"; ctx.shadowBlur = 8;
      ctx.fillText("FINISH", x + 20, roadY - 8);
      ctx.restore();
    }
  }

  /* ---------- side-view vector car ---------- */
  _car(ctx, x, wheelY, o) {
    const s = o.scale;
    const w = 130 * s, h = 38 * s;
    const y = wheelY - o.bob - h;
    ctx.save();

    /* underglow */
    if (o.night || o.under) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = o.body;
      ctx.globalAlpha = o.ghost ? 0.05 : 0.14;
      ctx.shadowColor = o.body;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(x, wheelY + 2, w * 0.52, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (o.ghost) {
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([4, 4]);
    }

    /* nitro flame exhaust */
    if (o.nitro) {
      ctx.globalCompositeOperation = "lighter";
      const fl = 30 + Math.random() * 18;
      const fg = ctx.createLinearGradient(x - w / 2, 0, x - w / 2 - fl, 0);
      fg.addColorStop(0, "rgba(120,200,255,0.9)");
      fg.addColorStop(0.5, "rgba(56,242,255,0.6)");
      fg.addColorStop(1, "rgba(56,242,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y + h * 0.55);
      ctx.lineTo(x - w / 2 - fl, y + h * 0.42);
      ctx.lineTo(x - w / 2, y + h * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    /* body */
    const bodyGrad = ctx.createLinearGradient(0, y, 0, y + h);
    bodyGrad.addColorStop(0, o.body);
    bodyGrad.addColorStop(1, this._shade(o.body, -45));
    ctx.fillStyle = bodyGrad;
    this._roundRect(ctx, x - w / 2, y, w, h, 10);
    ctx.fill();
    /* spoiler */
    ctx.fillStyle = this._shade(o.body, -60);
    ctx.fillRect(x - w / 2 - 5, y - 6, 8, h * 0.55);

    /* cabin */
    ctx.fillStyle = this._shade(o.body, -70);
    this._roundRect(ctx, x - w * 0.12, y - h * 0.28, w * 0.5, h * 0.75, 6);
    ctx.fill();
    /* window */
    ctx.fillStyle = o.ghost ? "#555c68" : "rgba(190,235,255,0.85)";
    this._roundRect(ctx, x - w * 0.06, y - h * 0.2, w * 0.38, h * 0.45, 4);
    ctx.fill();

    /* headlight / taillight */
    ctx.fillStyle = o.night ? "#ffe9a8" : "#ffffff";
    ctx.shadowColor = o.night ? "#ffd166" : "#38f2ff";
    ctx.shadowBlur = 8;
    ctx.fillRect(x + w / 2 - 3, y + h * 0.3, 3, 7);
    ctx.fillStyle = "#ff4444";
    ctx.shadowColor = "#ff2222";
    ctx.fillRect(x - w / 2, y + h * 0.3, 3, 7);
    ctx.shadowBlur = 0;

    /* wheels with rotating spokes */
    const r = 9 * s;
    const wy = y + h + r - 1;
    for (const wx of [x - w * 0.26, x + w * 0.24]) {
      ctx.fillStyle = "#0c0c10";
      ctx.beginPath(); ctx.arc(wx, wy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#3a3f4a"; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(o.wheel);
      ctx.strokeStyle = o.ghost ? "#888" : "#8ab4d8";
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.rotate(Math.PI * 2 / 3);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.75, 0); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* lighten/darken a hex color */
  _shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = TR.clamp((n >> 16) + amt, 0, 255);
    const g = TR.clamp(((n >> 8) & 0xff) + amt, 0, 255);
    const b = TR.clamp((n & 0xff) + amt, 0, 255);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
};
