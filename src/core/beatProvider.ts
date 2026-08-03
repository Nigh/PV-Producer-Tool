// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

/**
 * Provides beat intensity (0~1) from a BPM metronome aligned to playback time.
 * Audio element is optional — used for music playback / clock; rhythm effects
 * always follow bpm + beatOffset so they can be nudged onto the song grid.
 */
export class BeatProvider {
  private audioCtx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private _bpm = 120;
  /** First-beat delay in beats (0..1). Shifts the metronome phase. */
  private _beatOffset = 0;
  private _useAudio = false;

  set bpm(val: number) { this._bpm = Math.max(30, Math.min(300, val)); }
  get bpm() { return this._bpm; }

  set beatOffset(val: number) { this._beatOffset = Math.max(0, Math.min(1, val)); }
  get beatOffset() { return this._beatOffset; }

  get isAudioMode() { return this._useAudio && this.audioEl !== null; }

  async loadAudio(file: File): Promise<HTMLAudioElement> {
    this.dispose();

    this.audioCtx = new AudioContext();

    const url = URL.createObjectURL(file);
    this.audioEl = new Audio();
    this.audioEl.src = url;
    this.audioEl.loop = true;

    this.source = this.audioCtx.createMediaElementSource(this.audioEl);
    this.source.connect(this.audioCtx.destination);

    this._useAudio = true;

    await this.audioEl.play();
    return this.audioEl;
  }

  /** Metronome intensity (0 ~ 1) at playback `time` (seconds). */
  getIntensity(time: number): number {
    return this.internalBeat(time);
  }

  private internalBeat(time: number): number {
    const beatInterval = 60 / this._bpm;
    const t = time - this._beatOffset * beatInterval;
    // Positive modulo so negative (pre-offset) times still phase correctly
    const phase = ((t % beatInterval) + beatInterval) % beatInterval / beatInterval;
    // Sharp attack, exponential decay
    return Math.exp(-phase * 6);
  }

  pause(): void {
    this.audioEl?.pause();
  }

  resume(): void {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.audioEl?.play();
  }

  get audioContext(): AudioContext | null { return this.audioCtx; }
  get sourceNode(): MediaElementAudioSourceNode | null { return this.source; }

  get paused(): boolean {
    return this.audioEl?.paused ?? true;
  }

  get currentTime(): number {
    return this.audioEl?.currentTime ?? 0;
  }

  get duration(): number {
    return this.audioEl?.duration ?? 0;
  }

  seek(time: number): void {
    if (!this.audioEl) return;
    const duration = Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : Infinity;
    this.audioEl.currentTime = Math.max(0, Math.min(time, duration));
  }

  dispose(): void {
    this.audioEl?.pause();
    this.source?.disconnect();
    this.audioCtx?.close();
    this.audioEl = null;
    this.source = null;
    this.audioCtx = null;
    this._useAudio = false;
  }
}
