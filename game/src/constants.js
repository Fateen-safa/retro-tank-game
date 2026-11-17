// Shared constants for the whole game.
export const W = 640;            // internal resolution (R1)
export const H = 360;
export const GROUND_Y = 328;     // default ground surface height
export const FONT = '"Press Start 2P", monospace';
// Art folder. The itch.io build (build.py) sets window.ASSET_BASE to its own copy.
export const ASSETS = window.ASSET_BASE || '../TankGame-Assets/';
export const GRAVITY = 700;      // px/s² for falling tanks and pickups

// Depth layers
export const DEPTH = {
  sky: 0,
  towers: 1,
  decor: 2,
  ground: 3,
  pad: 4,
  enemy: 8,
  barrel: 9,
  tank: 10,
  shield: 11,
  shot: 12,
  fx: 13,
  hud: 100,
};

// Text style helper (pixel font, crisp)
export function textStyle(size = 8, color = '#ffffff') {
  return { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 1 };
}

export const LEVELS = ['level1', 'level2', 'level3'];

// Level 1's background, also used on the menus.
export const DEFAULT_BG = [
  { key: 'aw-sky', scale: 2, scroll: 0.05 },
  { key: 'aw-towers', scale: 2, scroll: 0.15, bottom: 24, alpha: 0.55 },
  { key: 'aw-towers', scale: 1, scroll: 0.4, bottom: 16 },
];

// Parallax background layers sized for the 640x360 view, anchored to the bottom of the screen.
// Each layer: { key, scale (whole number), scroll (0 = fixed, 1 = moves with the world), bottom (px up from the bottom), alpha, tint }
// Returns a function to call each frame with the camera's scrollX.
export function addBackground(scene, layers = DEFAULT_BG) {
  const made = layers.map((L, i) => {
    const src = scene.textures.get(L.key).getSourceImage();
    const scale = L.scale || 1;
    const t = scene.add.tileSprite(0, H - (L.bottom || 0), W, src.height * scale, L.key)
      .setOrigin(0, 1).setTileScale(scale).setScrollFactor(0).setDepth(-10 + i) // always behind everything else
      .setAlpha(L.alpha ?? 1);
    if (L.tint) t.setTint(Number(L.tint));
    return [t, L.scroll || 0];
  });
  return (scrollX) => { for (const [l, f] of made) l.tilePositionX = scrollX * f / l.tileScaleX; };
}
