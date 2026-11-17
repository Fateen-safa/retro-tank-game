// Saved progress in localStorage. Storage can be blocked (private windows, previews),
// so every access is guarded and the game still works without it.
const BEST = 'retroTank.bestScore';
const UNLOCKED = 'retroTank.unlocked';
const SEEN_HOWTO = 'retroTank.seenHowTo';

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } };

export function getBest() { return Number(get(BEST)) || 0; }

// Saves the score if it beats the best. Returns true when it is a new best.
export function submitScore(score) {
  if (score <= getBest()) return false;
  set(BEST, score);
  return true;
}

// Highest level index the player may start from (0 = only Level 1).
export function getUnlocked() { return Number(get(UNLOCKED)) || 0; }
export function unlockLevel(index) { if (index > getUnlocked()) set(UNLOCKED, index); }

export function hasSeenHowTo() { return get(SEEN_HOWTO) === '1'; }
export function markHowToSeen() { set(SEEN_HOWTO, '1'); }
