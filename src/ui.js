// ui.js - 2D overlay drawing (internal-resolution canvas, scaled up pixelated).
export const SERIF = 'Georgia, "Times New Roman", serif';

export class UI {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.floats = [];
    this.toasts = [];
    this.buttons = [];
  }

  // the overlay is drawn in virtual (360p) units onto a `scale`x canvas: crisp text, pixel icons
  resize(W, H, scale = 2) { this.W = W; this.H = H; this.s = scale; this.c.width = W * scale; this.c.height = H * scale; }

  clear() {
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.clearRect(0, 0, this.c.width, this.c.height);
    this.g.setTransform(this.s, 0, 0, this.s, 0, 0);
    this.g.imageSmoothingEnabled = false;
    this.buttons = [];
  }

  text(str, x, y, { size = 12, color = '#f2ead8', align = 'left', base = 'alphabetic', bold = true, outline = '#0c0810',
                    ow = 3, font = SERIF, alpha = 1, spacing = 0 } = {}) {
    const g = this.g;
    g.save();
    g.globalAlpha = alpha;
    g.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    g.textAlign = align; g.textBaseline = base;
    if ('letterSpacing' in g) g.letterSpacing = spacing + 'px';
    if (outline) { g.lineJoin = 'round'; g.lineWidth = ow; g.strokeStyle = outline; g.strokeText(str, x, y); }
    g.fillStyle = color;
    g.fillText(str, x, y);
    g.restore();
  }

  measure(str, size = 12, bold = true) {
    this.g.font = `${bold ? 'bold ' : ''}${size}px ${SERIF}`;
    return this.g.measureText(str).width;
  }

  wrap(str, maxW, size = 11) {
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (this.measure(t, size, false) > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  // stone-framed panel like the concept's UI plates
  panel(x, y, w, h, { fill = 'rgba(14,12,20,0.92)', border = '#4c4f5a', hi = '#6a6e7a', alpha = 1 } = {}) {
    const g = this.g;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = '#0a080c'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = border; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = hi; g.fillRect(x - 2, y - 2, w + 4, 1); g.fillRect(x - 2, y - 2, 1, h + 4);
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    g.restore();
  }

  bar(x, y, w, h, frac, color = '#c82a30', back = '#2a1416') {
    const g = this.g;
    g.fillStyle = '#0a0608'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = back; g.fillRect(x, y, w, h);
    g.fillStyle = color; g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 1);
  }

  icon(img, x, y, size) { if (img) this.g.drawImage(img, Math.round(x), Math.round(y), size, size); }

  // clickable button; returns true if the pointer is over it
  button(id, label, x, y, w, h, pointer, { size = 12, color = '#f2ead8', fill = '#3a2a2c', hotFill = '#5a3a3e',
                                            disabled = false, focus = false } = {}) {
    const hot = !disabled && pointer && pointer[0] >= x && pointer[0] <= x + w && pointer[1] >= y && pointer[1] <= y + h;
    this.panel(x, y, w, h, { fill: disabled ? '#1c1a20' : (hot || focus ? hotFill : fill), border: focus ? '#d8a038' : '#4c4f5a' });
    this.text(label, x + w / 2, y + h / 2 + 1, { size, align: 'center', base: 'middle', color: disabled ? '#6a6470' : color });
    this.buttons.push({ id, x, y, w, h, disabled });
    return hot;
  }

  hit(pt) {
    if (!pt) return null;
    for (const b of this.buttons) {
      if (!b.disabled && pt[0] >= b.x && pt[0] <= b.x + b.w && pt[1] >= b.y && pt[1] <= b.y + b.h) return b.id;
    }
    return null;
  }

  float(str, x, y, color, now, { size = 16, dy = -28, dur = 1.0 } = {}) {
    this.floats.push({ str, x, y, color, t0: now, size, dy, dur });
  }

  toast(str, now, color = '#f2ead8', dur = 2.2) { this.toasts.push({ str, t0: now, color, dur }); }

  drawFloats(now) {
    this.floats = this.floats.filter(f => now - f.t0 < f.dur);
    for (const f of this.floats) {
      const t = (now - f.t0) / f.dur;
      const pop = t < 0.15 ? 1 + (0.15 - t) * 3 : 1;
      this.text(f.str, f.x, f.y + f.dy * Math.min(1, t * 1.6), { size: Math.round(f.size * pop), color: f.color, align: 'center',
        alpha: t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1 });
    }
    this.toasts = this.toasts.filter(t => now - t.t0 < t.dur);
    this.toasts.forEach((t, i) => {
      const a = now - t.t0 < 0.2 ? (now - t.t0) / 0.2 : (t.dur - (now - t.t0) < 0.4 ? (t.dur - (now - t.t0)) / 0.4 : 1);
      this.text(t.str, this.W / 2, 58 + i * 16, { size: 13, color: t.color, align: 'center', alpha: a });
    });
  }
}
