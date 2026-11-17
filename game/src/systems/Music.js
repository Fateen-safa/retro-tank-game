import { volumes } from './Sfx.js';

// One music player for the whole game (kept in the game registry so it survives scene changes).
// play() crossfades to a new looping track; playing the track that's already on does nothing.
export default class Music {
  static get(scene) {
    let m = scene.game.registry.get('music');
    if (!m) { m = new Music(scene.game); scene.game.registry.set('music', m); }
    return m;
  }

  constructor(game) {
    this.game = game;
    this.current = null;
    this.key = null;
    this.enabled = !!game.sound.context && game.cache.audio.exists('music-title');
  }

  play(key, rate = 1) {
    if (!this.enabled) return;
    if (this.key === key && this.current?.isPlaying) {
      if (this.current.rate !== rate) this.current.setRate(rate);
      return;
    }
    this.stop(400);
    this.key = key;
    const s = this.game.sound.add(`music-${key}`, { loop: true, volume: 0 });
    s.play({ rate });
    this.current = s;
    this.fade(s, volumes.music, 600);
  }

  stop(ms = 400) {
    const s = this.current;
    this.current = null;
    this.key = null;
    if (!s) return;
    this.fade(s, 0, ms, () => s.destroy());
  }

  applyVolume() { if (this.current) this.current.setVolume(volumes.music); }

  // Simple volume ramp on real time (works across scene changes)
  fade(s, to, ms, done) {
    const from = s.volume;
    const start = performance.now();
    const tick = () => {
      if (!s.manager) return; // destroyed
      const k = Math.min(1, (performance.now() - start) / ms);
      s.setVolume(from + (to - from) * k);
      if (k < 1) setTimeout(tick, 16); else done?.();
    };
    tick();
  }
}
