import { SOUNDS, renderSound } from './Synth.js';
import { SONGS, songLayers } from './Songs.js';

const SFX_KEY = 'retroTank.sfxVolume';
const MUSIC_KEY = 'retroTank.musicVolume';

// Separate volumes for sound effects and music (0..1), saved in the browser.
// Storage can be blocked, so guard every access.
function load(key, def) {
  try { const v = localStorage.getItem(key); return v === null ? def : Phaser.Math.Clamp(Number(v), 0, 1); } catch { return def; }
}
function save(key, v) { try { localStorage.setItem(key, String(v)); } catch { /* ignore */ } }

export const volumes = { sfx: load(SFX_KEY, 0.8), music: load(MUSIC_KEY, 0.5) };
export function setSfxVolume(v) { volumes.sfx = Phaser.Math.Clamp(Math.round(v * 10) / 10, 0, 1); save(SFX_KEY, volumes.sfx); }
export function setMusicVolume(v, game) {
  volumes.music = Phaser.Math.Clamp(Math.round(v * 10) / 10, 0, 1);
  save(MUSIC_KEY, volumes.music);
  game?.registry.get('music')?.applyVolume();
}

// Turn every synth recipe and song into an audio buffer in Phaser's audio cache. Call once at boot.
export function buildSounds(game) {
  const ctx = game.sound.context;
  if (!ctx) return false; // no Web Audio: game runs silently
  const sr = ctx.sampleRate;
  const add = (key, data) => {
    const buf = ctx.createBuffer(1, data.length, sr);
    buf.copyToChannel(data, 0);
    game.cache.audio.add(key, buf);
  };
  for (const [key, layers] of Object.entries(SOUNDS)) add(`sfx-${key}`, renderSound(layers, sr));
  for (const [key, spec] of Object.entries(SONGS)) {
    const { layers, length } = songLayers(spec);
    add(`music-${key}`, renderSound(layers, sr, length));
  }
  return true;
}

// Plays sounds with small random pitch changes (so repeats don't sound robotic)
// and limits how often the same sound can start, so big fights don't turn into noise.
export default class Sfx {
  constructor(scene) {
    this.scene = scene;
    this.last = new Map();
    this.enabled = !!scene.sound.context && scene.cache.audio.exists('sfx-shoot');
  }

  play(key, { vol = 1, detune = 60, gapMs = 35, rate = 1 } = {}) {
    if (!this.enabled || volumes.sfx <= 0) return null;
    const now = performance.now();
    if (now - (this.last.get(key) || 0) < gapMs) return null;
    this.last.set(key, now);
    const s = this.scene.sound.add(`sfx-${key}`);
    s.once('complete', () => s.destroy());
    s.play({ volume: vol * volumes.sfx, detune: (Math.random() * 2 - 1) * detune, rate });
    return s;
  }

  // Volume relative to how far the source is from the camera centre (quieter off screen).
  at(key, x, opts = {}) {
    const cam = this.scene.cameras.main;
    const d = Math.abs(x - (cam.scrollX + cam.width / 2));
    const fall = Phaser.Math.Clamp(1 - (d - cam.width / 2) / 400, 0.15, 1);
    return this.play(key, { ...opts, vol: (opts.vol ?? 1) * fall });
  }
}
