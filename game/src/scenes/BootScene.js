import { W, H, ASSETS, LEVELS, textStyle } from '../constants.js';
import { buildSounds } from '../systems/Sfx.js';

function makeOverlayTextures(scene) {
  // Vignette: darker toward the edges
  const v = scene.textures.createCanvas('vignette', W, H);
  const ctx = v.getContext();
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, 'rgba(10,4,12,0)');
  g.addColorStop(1, 'rgba(10,4,12,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  v.refresh();
  // Red version for damage / low-HP warnings
  const r = scene.textures.createCanvas('vignette-red', W, H);
  const rc = r.getContext();
  const rg = rc.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.6);
  rg.addColorStop(0, 'rgba(255,40,30,0)');
  rg.addColorStop(1, 'rgba(255,40,30,0.6)');
  rc.fillStyle = rg;
  rc.fillRect(0, 0, W, H);
  r.refresh();
  // Scanlines: one dark row every 2 px
  const s = scene.textures.createCanvas('scanlines', 4, 2);
  const sc = s.getContext();
  sc.fillStyle = 'rgba(0,0,0,0.12)';
  sc.fillRect(0, 1, 4, 1);
  s.refresh();
}

// Gem sheet: 16x16 grid, 53 columns. Each color has 7 frames in row 2.
export const GEM_COLS = 53;
export const GEM_COLOR = { health: 0, spread: 2, charged: 5 }; // teal/green, red, blue
export const gemFrames = (color) => ({ start: 2 * GEM_COLS + 4 + color * 8, end: 2 * GEM_COLS + 4 + color * 8 + 6 });
export const CRATE_FRAME = 4 * GEM_COLS; // empty item box

// Loads every asset Milestones 1–2 use and sets up animations + tileset frames.
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const label = this.add.text(W / 2, H / 2, 'LOADING 0%', textStyle(8)).setOrigin(0.5);
    this.load.on('progress', (p) => label.setText(`LOADING ${Math.round(p * 100)}%`));
    this.load.on('loaderror', (file) => console.error('Failed to load', file.key, file.url));

    const A = ASSETS;
    const sheet = (key, path, frameWidth, frameHeight) => this.load.spritesheet(key, A + path, { frameWidth, frameHeight });

    // Player tank (hull frames with the barrel removed, plus the barrel on its own)
    sheet('tank-hull', 'player/tank/edited/hull-sheet.png', 128, 64);
    this.load.image('tank-barrel', A + 'player/tank/edited/barrel.png');

    // Enemies
    sheet('walker-walk', 'enemies/alien-walking-enemy/Spritesheets/alien-enemy-walk.png', 57, 42);
    sheet('walker-idle', 'enemies/alien-walking-enemy/Spritesheets/alien-enemy-idle.png', 48, 48);
    sheet('flyer', 'enemies/alien-flying-enemy/spritesheet.png', 83, 64);
    sheet('bipedal', 'enemies/bipedal-Unit/spritesheet.png', 80, 64);
    sheet('bomber', 'enemies/spaceship-unit/Spritesheets/Spritesheet.png', 106, 77);
    sheet('mech', 'enemies/mech-unit/spritesheet/mech-unit.png', 96, 80);

    // Projectiles
    sheet('bolt', 'projectiles/Bolt/spritesheet.png', 48, 32);
    sheet('pulse', 'projectiles/Pulse/spritesheet.png', 63, 32);
    sheet('spark', 'projectiles/spark/spritesheet.png', 63, 32);
    sheet('charged', 'projectiles/charged/spritesheet.png', 63, 48);
    sheet('crossed', 'projectiles/crossed/spritesheet.png', 32, 32);
    sheet('waveform', 'projectiles/waveform/spritesheet.png', 95, 32);
    sheet('fire-ball', 'fx/grotto/fire-ball/spritesheet.png', 52, 29);

    // Parry shield, teleporter and parry-spark effects
    sheet('energy-shield', 'fx/grotto/energy-shield/spritesheet.png', 51, 47);
    sheet('electro-shock', 'fx/grotto/electro-shock/spritesheet.png', 128, 96);
    sheet('energy-smack', 'fx/grotto/energy-smack/spritesheet.png', 128, 96);

    // Effects
    sheet('hit', 'fx/hit/hit.png', 31, 32);
    sheet('enemy-death', 'fx/enemy-death/spritesheet.png', 48, 48);
    sheet('explosion-a', 'fx/explosions/explosion-1-a/spritesheet.png', 32, 32);
    sheet('explosion-b', 'fx/explosions/explosion-1-b/spritesheet.png', 64, 64);
    sheet('tank-explosion', 'fx/explosions/explosion-1-c/spritesheet.png', 128, 80);
    sheet('explosion-f', 'fx/explosions/explosion-1-f/Sprites.png', 48, 48);
    sheet('explosion-g', 'fx/explosions/explosion-1-g/spritesheet.png', 48, 48);
    sheet('ground-explosion', 'fx/ground-explosion/spritesheet/explosion-animation.png', 112, 128);
    sheet('hits-1', 'fx/hits/hits-1/spritesheet.png', 32, 32);
    sheet('hits-2', 'fx/hits/Hits-2/spritesheet.png', 32, 32);
    sheet('hits-3', 'fx/hits/Hits-3/spritesheet.png', 32, 32);
    sheet('hits-4', 'fx/hits/hits-4/spritesheet.png', 32, 32);
    sheet('hits-5', 'fx/hits/Hits-5/spritesheet.png', 32, 32);
    sheet('hits-6', 'fx/hits/Hits-6/spritesheet.png', 32, 32);

    // Pickups
    sheet('gems', 'pickups/gems/spritesheets/gems-spritesheet.png', 16, 16);

    // HUD: icons drawn for this game, plus pilot / boss portraits from the pack
    this.load.image('hud-icons', A + 'ui/hud-icons.png');
    this.load.image('portrait-pilot', A + 'ui/portraits/base2.png');
    this.load.image('portrait-boss', A + 'ui/portraits/base4.png');
    this.load.image('portrait-boss2', A + 'ui/portraits/base3.png');

    // Environment: another-world
    const ENV = A + 'environments/another-world/PNG/layered/';
    this.load.image('aw-sky', ENV + 'sky.png');
    this.load.image('aw-towers', ENV + 'back-towers.png');
    this.load.image('aw-composed', ENV + 'composed-bg.png');
    this.load.image('aw-tiles', ENV + 'another-world-tileset.png');

    // Environment: desert outpost + alien base (Level 2)
    const D = A + 'environments/desert-outpost/PNG/';
    this.load.image('d-sky', D + 'sky.png');
    this.load.image('d-back', D + 'back.png');
    this.load.image('d-tiles', D + 'sci-fi-environment-tileset.png');
    this.load.image('ab-tiles', A + 'environments/alien-base/PNG/layers/tileset.png');

    // Environment: junk wastelands + industrial skyline (Level 3)
    const J = A + 'environments/junk-wastelands/layers/';
    this.load.image('j-back', J + 'back.png');
    this.load.image('j-middle', J + 'middle.png');
    this.load.image('j-near', J + 'near.png');
    this.load.image('j-tiles', J + 'tileset.png');
    this.load.image('ind-far', A + 'environments/industrial-parallax/Layers/far-buildings.png');
    this.load.image('ind-buildings', A + 'environments/industrial-parallax/Layers/buildings.png');

    // Flying vehicles (Level 2 strafers + gunship boss, Level 3 dreadnought)
    const V = A + 'enemies/flying-vehicles/';
    sheet('vehicle1', 'enemies/flying-vehicles/vehicle 1/spritesheet.png', 176, 96);
    sheet('vehicle2', 'enemies/flying-vehicles/vehicle 2/spritesheet.png', 176, 125);
    this.load.image('vehicle3', V + 'vehicle 3/vehicle-3-static.png');
    for (let i = 1; i <= 3; i++) {
      this.load.image(`v1-thrust${i}`, V + `vehicle 1/thrust/thrust${i}.png`);
      this.load.image(`v2-thrust${i}`, V + `vehicle 2/thrust/thrust${i}.png`);
      this.load.image(`v3-back${i}`, V + `vehicle 3/Sprites/frames-thrust/thrust-back/thrust-back${i}.png`);
      this.load.image(`v3-bottom${i}`, V + `vehicle 3/Sprites/frames-thrust/thrust-bottom/thrust-bottom${i}.png`);
    }
    sheet('explosion-d', 'fx/explosions/explosion-1-d/spritsheet.png', 128, 128);
    sheet('explosion-e', 'fx/explosions/explosion-1-e/explosion-5.png', 192, 192);

    // Data
    this.load.json('stats', 'src/data/stats.json');
    for (const key of LEVELS) this.load.json(key, `src/data/levels/${key}.json`);
  }

  create() {
    // Named pieces cut from the another-world tileset: [x, y, w, h]
    const tiles = this.textures.get('aw-tiles');
    const pieces = {
      'ground-top-a': [160, 32, 16, 16],
      'ground-top-b': [160, 64, 16, 16],
      'ground-fill': [160, 96, 16, 16],
      'block-small': [80, 32, 16, 16],
      'block-dark': [80, 64, 16, 16],
      'plant-small': [192, 32, 16, 64],
      'plant-big': [224, 32, 32, 64],
      'crate': [32, 16, 32, 32],
      'brick-stack': [112, 32, 32, 64],
      'gate': [272, 16, 32, 112],
      'beacon': [272, 16, 32, 48],
      'hanging-wreck': [32, 64, 32, 48],
    };
    for (const [name, [x, y, w, h]] of Object.entries(pieces)) tiles.add(name, 0, x, y, w, h);

    // Each level file can name pieces of its own tilesets: { texture: { name: [x, y, w, h] } }
    for (const key of LEVELS) {
      const L = this.cache.json.get(key);
      for (const [texKey, list] of Object.entries(L.pieces || {})) {
        const tex = this.textures.get(texKey);
        for (const [name, [x, y, w, h]] of Object.entries(list)) if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
      }
    }

    // Two-frame animations built from loose frame images (vehicle thrusters)
    const loose = (key, prefix, rate) => this.anims.create({ key, frames: [1, 2, 3].map((i) => ({ key: `${prefix}${i}` })), frameRate: rate, repeat: -1 });
    loose('v1-thrust', 'v1-thrust', 16);
    loose('v2-thrust', 'v2-thrust', 16);
    loose('v3-back', 'v3-back', 16);
    loose('v3-bottom', 'v3-bottom', 16);

    const hud = this.textures.get('hud-icons');
    const icons = { 'cell-full': [0, 0, 8, 12], 'cell-empty': [8, 0, 8, 12], 'life': [16, 0, 16, 10], 'panel': [32, 0, 16, 16], 'shield-icon': [48, 0, 8, 8] };
    for (const [name, [x, y, w, h]] of Object.entries(icons)) hud.add(name, 0, x, y, w, h);

    // Generated textures: a soft dark vignette and faint scanlines for the screen overlay
    makeOverlayTextures(this);

    // Sound effects are synthesized here (no audio files needed)
    buildSounds(this.game);

    const anim = (key, sheetKey, frameRate, repeat = 0, range = undefined) =>
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(sheetKey, range || {}), frameRate, repeat });

    anim('tank-drive', 'tank-hull', 12, -1);
    anim('walker-walk', 'walker-walk', 10, -1);
    anim('walker-idle', 'walker-idle', 6, -1);
    anim('flyer-fly', 'flyer', 14, -1);
    anim('bipedal-walk', 'bipedal', 9, -1);
    anim('bomber-fly', 'bomber', 12, -1);
    anim('mech-walk', 'mech', 10, -1);

    anim('bolt-fly', 'bolt', 14, -1);
    anim('pulse-fly', 'pulse', 12, -1);
    anim('spark-fly', 'spark', 14, -1);
    anim('charged-fly', 'charged', 14, -1);
    anim('crossed-spin', 'crossed', 16, -1);
    anim('wave-fly', 'waveform', 14, -1);
    anim('fire-fly', 'fire-ball', 12, -1);

    anim('shield-up', 'energy-shield', 24, 0, { start: 0, end: 4 });
    anim('shield-break', 'energy-shield', 20, 0, { start: 5, end: 7 });
    anim('pad-orb', 'energy-shield', 6, -1, { start: 0, end: 3 });
    anim('teleport', 'electro-shock', 24, 0, { start: 2, end: 8 });
    anim('parry-spark', 'energy-smack', 24);

    anim('hit', 'hit', 18);
    anim('enemy-death', 'enemy-death', 16);
    anim('explosion-a', 'explosion-a', 24);
    anim('explosion-b', 'explosion-b', 16);
    anim('tank-explode', 'tank-explosion', 12);
    anim('explosion-d', 'explosion-d', 18);
    anim('explosion-e', 'explosion-e', 20);
    anim('vehicle1-fly', 'vehicle1', 10, -1);
    anim('vehicle2-fly', 'vehicle2', 10, -1);
    anim('explosion-f', 'explosion-f', 18);
    anim('explosion-g', 'explosion-g', 18);
    anim('ground-explosion', 'ground-explosion', 14);
    for (let i = 1; i <= 6; i++) anim(`hits-${i}`, `hits-${i}`, 20);

    for (const [type, color] of Object.entries(GEM_COLOR)) anim(`gem-${type}`, 'gems', 10, -1, gemFrames(color));

    this.scene.start('Title');
  }
}
