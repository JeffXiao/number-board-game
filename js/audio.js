/* 数学十字谜 — audio module.
   Synthesized live with Web Audio — no files. There is no background
   music: the speaker button on the landing page is the on/off switch for
   these effects, owned here. Sound is on by default; when off,
   placing a number makes no sound and the win jingle stays silent.
     1. playChipSound — the moment a number lands in a cell: two
        quick casino-chip clacks (short filtered noise bursts) plus a
        bright two-tone coin chime, like a betting machine taking a chip.
     2. playWinJingle — when the whole board is solved: a short
        cheerful fanfare, a rising arpeggio into a bright major chord. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const AUDIO = MC.CONFIG.AUDIO;

  let context = null;
  let master = null;
  let noiseBuffer = null;
  let soundEnabled = true;

  function makeNoiseBuffer() {
    let length = Math.floor(context.sampleRate * AUDIO.NOISE_SECONDS);
    let buffer = context.createBuffer(1, length, context.sampleRate);
    let data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  function createContext() {
    let AudioContextCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextCtor) return false;
    context = new AudioContextCtor();
    master = context.createGain();
    master.gain.value = AUDIO.MASTER_GAIN;
    master.connect(context.destination);
    noiseBuffer = makeNoiseBuffer();
    return true;
  }
  function ensureContext() {
    if (!context && !createContext()) return false;
    if (context.state === "suspended") context.resume();
    return true;
  }
  /* shared audio-graph wiring: source -> filter -> gain -> out */
  function wireNodes(first, filter, gain, destination) {
    first.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
  }
  /* shared tone envelope: fast attack, exponential decay to silence */
  function setToneEnvelope(param, start, duration, volume, attack) {
    param.setValueAtTime(0.0001, start);
    param.exponentialRampToValueAtTime(volume, start + attack);
    param.exponentialRampToValueAtTime(0.0001, start + duration);
  }
  function chipClack(start) {
    let source = context.createBufferSource();
    source.buffer = noiseBuffer;
    let filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = AUDIO.CHIP_FILTER_FREQ;
    filter.Q.value = AUDIO.CHIP_FILTER_Q;
    let gain = context.createGain();
    gain.gain.setValueAtTime(AUDIO.CHIP_GAIN, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + AUDIO.CHIP_DECAY_S);
    wireNodes(source, filter, gain, master);
    source.start(start);
    source.stop(start + AUDIO.CHIP_STOP_S);
  }
  function tone(freq, start, duration, type, volume) {
    let oscillator = context.createOscillator();
    let gain = context.createGain();
    let filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = AUDIO.TONE_FILTER_FREQ;
    oscillator.type = type;
    oscillator.frequency.value = freq;
    setToneEnvelope(gain.gain, start, duration, volume, AUDIO.TONE_ATTACK_S);
    wireNodes(oscillator, filter, gain, master);
    oscillator.start(start);
    oscillator.stop(start + duration + AUDIO.TONE_TAIL_S);
  }
  function playChipSound() {
    if (!soundEnabled) return;
    if (!ensureContext()) return;
    let start = context.currentTime + AUDIO.START_OFFSET_S;
    chipClack(start);
    chipClack(start + AUDIO.SECOND_CLACK_DELAY_S);
    /* coin chime on top of the second clack */
    tone(AUDIO.COIN_FIRST_FREQ, start + AUDIO.COIN_FIRST_AT_S, AUDIO.COIN_FIRST_DUR_S, "square", AUDIO.COIN_FIRST_VOL);
    tone(AUDIO.COIN_SECOND_FREQ, start + AUDIO.COIN_SECOND_AT_S, AUDIO.COIN_SECOND_DUR_S, "square", AUDIO.COIN_SECOND_VOL);
  }
  function playWinChord(chordAt) {
    /* final bright C-major chord, held, with a G6 sparkle on top */
    AUDIO.WIN_CHORD.forEach(function (freq) { tone(freq, chordAt, AUDIO.WIN_CHORD_DUR_S, "triangle", AUDIO.WIN_CHORD_VOL); });
    tone(AUDIO.WIN_CHORD_SPARKLE_FREQ, chordAt + AUDIO.WIN_CHORD_SPARKLE_AT_S, AUDIO.WIN_CHORD_SPARKLE_DUR_S, "sine", AUDIO.WIN_CHORD_SPARKLE_VOL);
  }
  function playWinArpeggio(start, step) {
    /* rising arpeggio: C5 E5 G5 C6, a hop back, then up to E6 */
    let sequence = AUDIO.WIN_ARPEGGIO;
    sequence.forEach(function (freq, index) {
      let isLast = index === sequence.length - 1;
      tone(freq, start + index * step, isLast ? step * AUDIO.WIN_LAST_NOTE_FACTOR : step * AUDIO.WIN_NOTE_FACTOR, "triangle", AUDIO.WIN_ARPEGGIO_VOL);
    });
    return sequence.length;
  }
  function playWinSparkle(start, step) {
    /* sparkle an octave up on the off-beats */
    AUDIO.WIN_SPARKLE.forEach(function (freq, index) {
      tone(freq * 2, start + (index * 2 + 1) * step * 0.5 + index * step, step * AUDIO.WIN_SPARKLE_DUR_FACTOR, "sine", AUDIO.WIN_SPARKLE_VOL);
    });
  }
  function playWinJingle() {
    if (!soundEnabled) return;
    if (!ensureContext()) return;
    let start = context.currentTime + AUDIO.WIN_START_OFFSET_S;
    let step = AUDIO.WIN_STEP_S;
    let count = playWinArpeggio(start, step);
    playWinSparkle(start, step);
    playWinChord(start + count * step + AUDIO.WIN_CHORD_GAP_S);
  }
  /* Toggling the switch on plays one chip click so the player hears
     it is back on; toggling off is silent. */
  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (soundEnabled) playChipSound();
    return soundEnabled;
  }

  MC.audio = Object.freeze({
    isEnabled: function () { return soundEnabled; },
    toggle: toggleSound,
    playChip: playChipSound,
    playWin: playWinJingle
  });
})(window);
