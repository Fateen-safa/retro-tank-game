import { H, DEPTH } from '../constants.js';

export const PLATFORM_THICKNESS = 16;

// Default look (Level 1 tileset). Levels can override with their "tiles" block.
const DEFAULT_TILES = {
  texture: 'aw-tiles',
  styles: {
    rock: { top: ['ground-top-a', 'ground-top-b'], fill: 'ground-fill' },
    metal: { top: ['block-small'], fill: 'block-dark' },
  },
  platform: { texture: 'aw-tiles', top: ['block-small'], under: 'hanging-wreck' },
};

// The ground is a polyline of points [x, y, style?] (M2-2).
// Two points with the same x make a vertical step; different x makes a ramp.
// Platforms are floating one-way ledges { x, w, y } (left edge, width, top).
export default class Terrain {
  constructor(scene, points, width, platforms = [], tiles = null) {
    this.scene = scene;
    this.width = width;
    this.tiles = tiles || DEFAULT_TILES;
    this.pts = points.map(([x, y, style]) => ({ x, y, style: style || null }));
    let last = 'rock';
    for (const p of this.pts) { if (p.style) last = p.style; else p.style = last; }
    this.platforms = platforms.map((p, i) => ({ ...p, index: i }));
  }

  segmentIndex(x) {
    const pts = this.pts;
    let i = 0;
    for (let k = 0; k < pts.length; k++) if (pts[k].x <= x) i = k; else break;
    return i;
  }

  // y of the ground surface at x (smaller = higher)
  heightAt(x) {
    const pts = this.pts;
    const i = this.segmentIndex(x);
    const a = pts[i], b = pts[i + 1];
    if (!b || b.x <= a.x) return a.y;
    const t = Phaser.Math.Clamp((x - a.x) / (b.x - a.x), 0, 1);
    return a.y + (b.y - a.y) * t;
  }

  styleAt(x) { return this.pts[this.segmentIndex(x)].style; }

  onPlatform(p, x) { return x >= p.x && x <= p.x + p.w; }

  // Height where something standing on `platform` (or the ground, if null) rests at x.
  standY(x, platform) { return platform ? platform.y : this.heightAt(x); }

  // True if (x, y) is inside the ground or a platform (shots stop here).
  isSolid(x, y) {
    if (y >= this.heightAt(x)) return true;
    for (const p of this.platforms) {
      if (this.onPlatform(p, x) && y >= p.y && y < p.y + PLATFORM_THICKNESS) return true;
    }
    return false;
  }

  // The first surface at or below y at column x: { y, platform }
  supportBelow(x, y) {
    let best = { y: this.heightAt(x), platform: null };
    for (const p of this.platforms) {
      if (this.onPlatform(p, x) && p.y >= y - 1 && p.y < best.y) best = { y: p.y, platform: p };
    }
    return best;
  }

  // A falling thing moved from prevY to y this frame: which surface did it land on, if any?
  landing(x, prevY, y) {
    let hit = null;
    for (const p of this.platforms) {
      if (this.onPlatform(p, x) && prevY <= p.y && y >= p.y && (!hit || p.y < hit.y)) hit = { y: p.y, platform: p };
    }
    if (hit) return hit;
    const g = this.heightAt(x);
    return y >= g ? { y: g, platform: null } : null;
  }

  render() {
    const s = this.scene;
    const T = this.tiles;
    const tex = T.texture;
    for (let x = 0; x < this.width; x += 16) {
      const top = Math.round(this.heightAt(x + 8));
      const st = T.styles[this.styleAt(x + 8)] || T.styles.rock;
      const col = x / 16;
      s.add.image(x, top, st.texture || tex, st.top[col % st.top.length]).setOrigin(0, 0).setDepth(DEPTH.ground);
      let y = top + 16;
      if (st.under) { s.add.image(x, y, st.texture || tex, st.under).setOrigin(0, 0).setDepth(DEPTH.ground); y += 16; }
      for (; y < H; y += 16) {
        const fill = Array.isArray(st.fill) ? st.fill[(col + Math.floor(y / 16)) % st.fill.length] : st.fill;
        s.add.image(x, y, st.texture || tex, fill).setOrigin(0, 0).setDepth(DEPTH.ground);
      }
    }
    const P = T.platform;
    for (const p of this.platforms) {
      let i = 0;
      for (let x = p.x; x < p.x + p.w; x += 16, i++) {
        s.add.image(x, p.y, P.texture || tex, P.top[i % P.top.length]).setOrigin(0, 0).setDepth(DEPTH.ground);
      }
      // Decoration hanging under wide platforms
      if (P.under && p.w >= 160) s.add.image(p.x + p.w / 2, p.y + 16, P.texture || tex, P.under).setOrigin(0.5, 0).setDepth(DEPTH.decor);
    }
  }
}
