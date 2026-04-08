export const palette = "@%#*+=-:.";

export const densityMap = {
  "@": 1.0,
  "%": 0.92,
  "#": 0.84,
  "*": 0.72,
  "+": 0.58,
  "=": 0.46,
  "-": 0.32,
  ":": 0.2,
  ".": 0.12
};

export const SETTINGS = {
  asciiDir: "asciis",
  maxParticles: 18000,
  rotateIntervalMs: 1000000,
  rescanIntervalMs: 15000,
  asciiTransitionMs: 1600,
  windStrength: 0.035,
  windSpeed: 0.42,
  windScale: 0.003,
  audioEnabled: true,
  audioRequestOnFirstGesture: true,
  audioFftSize: 256,
  audioSmoothing: 0.82,
  audioBeatThreshold: 0.24,
  audioBeatCooldownMs: 220,
  audioMaxJitter: 22,
  audioShapeLoss: 0.72,
  audioRepelStrength: 0.32
};

export const canvas = document.getElementById("scene");
export const ctx = canvas.getContext("2d");

export const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  rawText: "",
  lines: [],
  particles: [],
  maxParticles: SETTINGS.maxParticles,
  mouse: {
    x: 0,
    y: 0,
    active: false
  },
  asciiFiles: [],
  currentAsciiIndex: -1,
  loadingList: false,
  loadingAscii: false,
  scanningEnabled: true,
  transitionUntil: 0,
  audio: {
    enabled: SETTINGS.audioEnabled,
    ready: false,
    active: false,
    mode: "none",
    level: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    beat: 0,
    lastBeatAt: 0,
    analyser: null,
    data: null,
    context: null,
    stream: null,
    source: null
  }
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function easeOutCubic(value) {
  const clamped = clamp(value, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

export function mix(a, b, amount) {
  return a + (b - a) * amount;
}

export function stableNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function stableNoise3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}
