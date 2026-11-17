import { DEPTH } from '../constants.js';

// Animation key -> texture key, where they differ.
const TEXTURE = { 'tank-explode': 'tank-explosion' };

// Play a one-shot effect animation and remove it when it ends.
export function spawnFx(scene, x, y, anim, { originY = 0.5, scale = 1, rotation = 0, depth = DEPTH.fx } = {}) {
  const fx = scene.add.sprite(x, y, TEXTURE[anim] || anim, 0)
    .setOrigin(0.5, originY).setScale(scale).setRotation(rotation).setDepth(depth);
  fx.play(anim);
  fx.once('animationcomplete', () => fx.destroy());
  return fx;
}
