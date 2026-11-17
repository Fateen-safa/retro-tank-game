import Enemy from './Enemy.js';
import { CRATE_FRAME } from '../scenes/BootScene.js';

// Supply crate (gem item box): one shot breaks it and drops a gem.
export default class Crate extends Enemy {
  constructor(scene, x, stats, drop, platform = null) {
    super(scene, x, scene.terrain.standY(x, platform), 'gems', stats, 'crate', platform);
    this.setFrame(CRATE_FRAME).setOrigin(0.5, 1);
    this.body.setSize(16, 16, false).setOffset(0, 0);
    this.drop = drop;
    this.deathFx = 'explosion-f';
    this.harmless = true;
  }

  think() { this.y = this.standY(); }
}
