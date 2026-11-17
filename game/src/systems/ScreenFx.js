import { W, H, DEPTH } from '../constants.js';

// Screen-wide overlays: soft vignette, faint scanlines, and a red edge for damage / low HP.
export default class ScreenFx {
  constructor(scene) {
    this.scene = scene;
    const fixed = (o) => o.setScrollFactor(0).setOrigin(0);
    fixed(scene.add.image(0, 0, 'vignette')).setDepth(DEPTH.hud - 3);
    fixed(scene.add.tileSprite(0, 0, W, H, 'scanlines')).setDepth(DEPTH.hud - 2);
    this.red = fixed(scene.add.image(0, 0, 'vignette-red')).setDepth(DEPTH.hud - 1).setAlpha(0);
    this.hurtUntil = 0;
  }

  hurt() { this.hurtUntil = this.scene.time.now + 260; }

  // lowHp: pulse the red edge while the player is on their last armor cell
  tick(time, lowHp) {
    let a = 0;
    if (time < this.hurtUntil) a = (this.hurtUntil - time) / 260;
    if (lowHp) a = Math.max(a, 0.25 + 0.2 * Math.sin(time / 160));
    this.red.setAlpha(a);
  }
}
