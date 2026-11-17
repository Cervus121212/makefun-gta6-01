// Procedural WebAudio sound: no audio files. An engine hum that follows the car's speed,
// a two-tone siren while the police are after you, gunshots, pickup blips and a small
// bass-and-hat loop. Everything is synthesised; mute with M. The context is created on
// the first user gesture, so browsers never block it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let step = 0;

  // A lazy bassline in A minor: one bar of eight steps, a low note and a hat tick per step.
  const BASS = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
  const STEP_SECONDS = 0.21;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      musicTimer = window.setInterval(() => {
        if (muted || !ctx || ctx.state !== 'running') return;
        const note = BASS[step % BASS.length];
        if (note > 0) blip(note, 0.16, 'triangle', 0.10);
        if (step % 2 === 0) noiseBurst(0.03, 0.05, 6000);
        step += 1;
      }, STEP_SECONDS * 1000);
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, seconds, type, volume) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  }

  function noiseBurst(seconds, volume, filterFreq) {
    if (!ctx || muted) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    /** Call on any user gesture; creates the context the first time. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum follows speed 0..1; call every frame while driving. */
    engine(speed01, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + speed01 * 0.07 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    /** Siren wails while wanted > 0; call every frame with the current wanted level. */
    siren(wanted, time) {
      if (!ctx || muted) return;
      const on = wanted > 0;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(time * 2.4) > 0 ? 720 : 960, ctx.currentTime, 0.05);
    },
    shot() {
      noiseBurst(0.12, 0.35, 1800);
    },
    punch() {
      noiseBurst(0.08, 0.25, 500);
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.18);
      window.setTimeout(() => blip(1320, 0.12, 'sine', 0.18), 70);
    },
    cash() {
      blip(1046, 0.1, 'triangle', 0.2);
      window.setTimeout(() => blip(1568, 0.16, 'triangle', 0.2), 90);
    },
    crash() {
      noiseBurst(0.25, 0.4, 900);
    },
    mission() {
      blip(523, 0.12, 'triangle', 0.2);
      window.setTimeout(() => blip(659, 0.12, 'triangle', 0.2), 110);
      window.setTimeout(() => blip(784, 0.22, 'triangle', 0.2), 220);
    },
    fail() {
      blip(330, 0.18, 'sawtooth', 0.14);
      window.setTimeout(() => blip(247, 0.3, 'sawtooth', 0.14), 160);
    },
  };
}
