// Emberfall — the sound of the fire, synthesized, no audio files.
// One file, one job: every beep, boom and chime the game makes is built here
// from oscillators and filtered noise, so the game ships no sound assets and
// never touches the network. The context starts on the first user gesture.

/** Frequencies, in Hz, of the little victory phrase and the defeat phrase. */
const WIN_NOTES = [523.25, 659.25, 783.99, 1046.5];
const LOSE_NOTES = [392, 311.13, 233.08];

export function createAudio() {
  let context = null;
  let muted = false;
  let noiseBuffer = null;

  /** Build the AudioContext lazily, on the first gesture that calls a sound. */
  function ensure() {
    if (context) return context;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
      const length = context.sampleRate * 0.5;
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      context = null;
    }
    return context;
  }

  /** A short oscillator blip that slides from `from` Hz to `to` Hz. */
  function blip(from, to, seconds, type, volume) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  /** A burst of filtered noise: the sound of something burning out. */
  function noise(seconds, filterHz, volume) {
    const ctx = ensure();
    if (!ctx || muted || !noiseBuffer) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(now);
    source.stop(now + seconds + 0.02);
  }

  /** A short phrase of notes, one after another. */
  function phrase(notes, noteSeconds, type, volume) {
    const ctx = ensure();
    if (!ctx || muted) return;
    notes.forEach((freq, index) => {
      const when = ctx.currentTime + index * noteSeconds;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(volume, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + noteSeconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + noteSeconds + 0.02);
    });
  }

  return {
    /** Flip the mute. Returns the new muted state. */
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Unlock the context from a gesture, so later sounds play at once. */
    unlock() {
      ensure();
    },
    shoot() {
      blip(880, 320, 0.07, 'square', 0.045);
    },
    hit() {
      noise(0.18, 900, 0.16);
      blip(220, 60, 0.16, 'sawtooth', 0.1);
    },
    burn() {
      noise(0.3, 2400, 0.14);
      blip(520, 90, 0.22, 'triangle', 0.09);
    },
    pickup() {
      blip(660, 990, 0.09, 'sine', 0.09);
    },
    heart() {
      blip(520, 780, 0.12, 'sine', 0.1);
      blip(780, 1040, 0.14, 'sine', 0.08);
    },
    nova() {
      noise(0.7, 3200, 0.22);
      blip(180, 1200, 0.6, 'sawtooth', 0.1);
    },
    wave() {
      blip(196, 392, 0.35, 'triangle', 0.12);
    },
    hurt() {
      blip(160, 50, 0.3, 'sawtooth', 0.16);
      noise(0.25, 500, 0.14);
    },
    win() {
      phrase(WIN_NOTES, 0.16, 'triangle', 0.12);
    },
    lose() {
      phrase(LOSE_NOTES, 0.28, 'triangle', 0.12);
    },
  };
}
