// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.
//
// 录制导出：普通模式走 MediaRecorder（mp4/webm），透明通道模式抓 PNG 序列打包 zip。

import { t } from '../i18n';
import { engine, ui } from './store.svelte';

export const rec = $state({
  recording: false,
  packing: false,
  timer: '',
});

const templateSlugs = [
  'blueBold', 'kineticSplit', 'bluePlane', 'cyberGrunge', 'geometric',
  'rainCity', 'cyberpunkHud', 'emotionCinema', 'hystericNight',
  'spiderWeb', 'staggeredText', 'calmVillain', 'girlyClouds',
];

function getTemplateSlug(): string {
  const val = ui.selected;
  if (val === 'custom') return 'custom';
  const idx = parseInt(val);
  return templateSlugs[idx] ?? 'unknown';
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recStartTime = 0;
let recTimerInterval: ReturnType<typeof setInterval> | null = null;

// PNG sequence capture for alpha mode
let pngFrameBuffer: Record<number, Blob> = {};
let pngFrameIndex = 0;
let pngCaptureRaf = 0;
let pngRecording = false;
let pngLastCaptureTime = 0;
const PNG_FPS = 30;

function capturePngFrame(canvas: HTMLCanvasElement) {
  if (!pngRecording) return;
  const now = performance.now();
  if (now - pngLastCaptureTime >= 1000 / PNG_FPS) {
    pngLastCaptureTime = now;
    const idx = pngFrameIndex++;
    canvas.toBlob((blob) => {
      if (blob) pngFrameBuffer[idx] = blob;
    }, 'image/png');
  }
  pngCaptureRaf = requestAnimationFrame(() => capturePngFrame(canvas));
}

async function finishPngExport(slug: string) {
  rec.packing = true;
  // Wait briefly for any pending toBlob callbacks to settle
  await new Promise(r => setTimeout(r, 200));

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder('frames')!;
  const totalFrames = pngFrameIndex;
  for (let i = 0; i < totalFrames; i++) {
    if (pngFrameBuffer[i]) {
      folder.file(`frame_${String(i).padStart(5, '0')}.png`, pngFrameBuffer[i]);
    }
  }
  zip.file('.pv', JSON.stringify({ v: '0914', t: Date.now(), fps: PNG_FPS, f: totalFrames }));
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `pv-${slug}-${PNG_FPS}fps-${Date.now()}.zip`);
  pngFrameBuffer = {};
  pngFrameIndex = 0;
  rec.packing = false;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function startTimer() {
  recStartTime = performance.now();
  rec.timer = '00:00';
  recTimerInterval = setInterval(() => {
    rec.timer = formatTime(performance.now() - recStartTime);
  }, 500);
}

function stopTimer() {
  if (recTimerInterval) { clearInterval(recTimerInterval); recTimerInterval = null; }
  rec.timer = '';
}

export const recLabel = () =>
  rec.packing ? t('packing') : rec.recording ? t('stop') : t('rec');

export function toggleRecording(): void {
  const useAlpha = engine.alphaMode;
  const slug = getTemplateSlug();

  // --- Alpha mode: PNG sequence capture ---
  if (useAlpha) {
    if (pngRecording) {
      pngRecording = false;
      cancelAnimationFrame(pngCaptureRaf);
      stopTimer();
      rec.recording = false;
      finishPngExport(slug);
      return;
    }
    pngFrameBuffer = {};
    pngFrameIndex = 0;
    pngLastCaptureTime = 0;
    pngRecording = true;
    rec.recording = true;
    startTimer();
    capturePngFrame(engine.canvas);
    return;
  }

  // --- Normal mode: MediaRecorder ---
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }

  const canvas = engine.canvas;
  const stream = canvas.captureStream(60);

  if (engine.beat.audioContext && engine.beat.sourceNode) {
    const dest = engine.beat.audioContext.createMediaStreamDestination();
    engine.beat.sourceNode.connect(dest);
    for (const track of dest.stream.getAudioTracks()) {
      stream.addTrack(track);
    }
  }

  const mp4Supported = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1');
  const mimeType = mp4Supported
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
  const ext = mp4Supported ? 'mp4' : 'webm';

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    stopTimer();
    rec.recording = false;
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: mimeType });
    downloadBlob(blob, `pv-${slug}-${Date.now()}.${ext}`);
  };

  mediaRecorder.start(100);
  rec.recording = true;
  startTimer();
}
