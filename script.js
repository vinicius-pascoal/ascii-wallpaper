const palette = "@%#*+=-:.";
const densityMap = {
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

const SETTINGS = {
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

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const state = {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(value) {
  const clamped = clamp(value, 0, 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function resizeCanvas() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;

  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  buildTargets();
}

function normalizeText(text) {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/\t/g, "    ")
    .replace(/\n+$/g, "");
}

function stableNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function stableNoise3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function randomSpawn() {
  const side = (Math.random() * 4) | 0;

  if (side === 0) {
    return { x: Math.random() * state.width, y: -20 - Math.random() * 120 };
  }
  if (side === 1) {
    return { x: state.width + 20 + Math.random() * 120, y: Math.random() * state.height };
  }
  if (side === 2) {
    return { x: Math.random() * state.width, y: state.height + 20 + Math.random() * 120 };
  }

  return { x: -20 - Math.random() * 120, y: Math.random() * state.height };
}

function createParticle(target) {
  const spawn = randomSpawn();
  return {
    x: spawn.x,
    y: spawn.y,
    vx: (Math.random() - 0.5) * 6,
    vy: (Math.random() - 0.5) * 6,
    tx: target.x,
    ty: target.y,
    size: 0.8,
    targetSize: target.size,
    alpha: 0,
    targetAlpha: target.alpha
  };
}

function updateAudioMetrics() {
  const audio = state.audio;

  if (!audio.active || !audio.data) {
    audio.level += (0 - audio.level) * 0.04;
    audio.bass += (0 - audio.bass) * 0.04;
    audio.mid += (0 - audio.mid) * 0.04;
    audio.treble += (0 - audio.treble) * 0.04;
    audio.beat += (0 - audio.beat) * 0.08;
    return;
  }

  let normalized = audio.data;

  if (audio.analyser) {
    audio.analyser.getByteFrequencyData(audio.data);
    normalized = audio.data;
  }

  const totalBins = normalized.length || 1;
  const bassEnd = Math.max(4, Math.floor(totalBins * 0.12));
  const midEnd = Math.max(bassEnd + 1, Math.floor(totalBins * 0.42));

  let bass = 0;
  let mid = 0;
  let treble = 0;

  for (let i = 0; i < bassEnd; i++) {
    bass += normalized[i];
  }

  for (let i = bassEnd; i < midEnd; i++) {
    mid += normalized[i];
  }

  for (let i = midEnd; i < totalBins; i++) {
    treble += normalized[i];
  }

  bass /= bassEnd;
  mid /= Math.max(1, midEnd - bassEnd);
  treble /= Math.max(1, totalBins - midEnd);

  if (bass > 1 || mid > 1 || treble > 1) {
    bass /= 255;
    mid /= 255;
    treble /= 255;
  }

  const energy = clamp((bass * 0.5) + (mid * 0.33) + (treble * 0.17), 0, 1);

  audio.bass += (bass - audio.bass) * (1 - SETTINGS.audioSmoothing);
  audio.mid += (mid - audio.mid) * (1 - SETTINGS.audioSmoothing);
  audio.treble += (treble - audio.treble) * (1 - SETTINGS.audioSmoothing);
  audio.level += (energy - audio.level) * (1 - SETTINGS.audioSmoothing);

  const now = performance.now();
  const beatReady = audio.bass > SETTINGS.audioBeatThreshold && (now - audio.lastBeatAt) > SETTINGS.audioBeatCooldownMs;

  if (beatReady) {
    audio.lastBeatAt = now;
    audio.beat = 1;
  } else {
    audio.beat += (0 - audio.beat) * 0.1;
  }
}

function setAudioData(audioArray) {
  const audio = state.audio;

  if (!audioArray || typeof audioArray.length !== "number" || audioArray.length === 0) {
    audio.active = false;
    return;
  }

  audio.data = audioArray;
  audio.active = true;
  audio.ready = true;
}

function startWallpaperEngineAudio() {
  if (!state.audio.enabled || typeof window.wallpaperRegisterAudioListener !== "function") {
    return false;
  }

  state.audio.mode = "wallpaper-engine";
  state.audio.ready = true;
  state.audio.active = true;

  window.wallpaperRegisterAudioListener((audioArray) => {
    setAudioData(audioArray);
  });

  return true;
}

function getAudioIntensity() {
  return clamp(state.audio.level, 0, 1);
}

function getAudioBeatPulse() {
  return clamp(state.audio.beat, 0, 1);
}

function getShapeLoss() {
  const audio = state.audio;
  return clamp((getAudioIntensity() * 0.7) + (audio.bass * 0.3), 0, 1);
}

async function startMicrophoneAudio() {
  const audio = state.audio;

  if (!audio.enabled || audio.active || audio.mode === "wallpaper-engine") {
    return;
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();

    analyser.fftSize = SETTINGS.audioFftSize;
    analyser.smoothingTimeConstant = 0.72;

    source.connect(analyser);

    audio.stream = stream;
    audio.context = context;
    audio.source = source;
    audio.analyser = analyser;
    audio.data = new Uint8Array(analyser.frequencyBinCount);
    audio.mode = "microphone";
    audio.active = true;
    audio.ready = true;
  } catch {
    audio.enabled = false;
    audio.active = false;
  }
}

function requestAudioStartOnGesture() {
  if (!SETTINGS.audioRequestOnFirstGesture || !state.audio.enabled || state.audio.mode === "wallpaper-engine") {
    return;
  }

  const handler = () => {
    void startMicrophoneAudio();
    window.removeEventListener("pointerdown", handler, true);
    window.removeEventListener("keydown", handler, true);
  };

  window.addEventListener("pointerdown", handler, true);
  window.addEventListener("keydown", handler, true);
}

function morphParticles(targets) {
  const particles = state.particles;

  while (particles.length < targets.length) {
    particles.push(createParticle(targets[particles.length]));
  }

  if (particles.length > targets.length) {
    particles.length = targets.length;
  }

  for (let i = 0; i < targets.length; i++) {
    const p = particles[i];
    const t = targets[i];
    p.tx = t.x;
    p.ty = t.y;
    p.targetSize = t.size;
    p.targetAlpha = t.alpha;
  }
}

function setAscii(text) {
  const normalized = normalizeText(text);
  state.rawText = normalized;
  state.lines = normalized ? normalized.split("\n") : [];
  buildTargets();
  state.transitionUntil = performance.now() + SETTINGS.asciiTransitionMs;
}

function isAsciiTransitionActive() {
  return performance.now() < state.transitionUntil;
}

function buildTargets() {
  if (!state.lines.length) {
    state.particles.length = 0;
    return;
  }

  const rows = state.lines.length;
  const cols = Math.max(...state.lines.map((line) => line.length), 1);

  const areaW = state.width * 0.88;
  const areaH = state.height * 0.8;
  const cell = Math.min(areaW / cols, areaH / rows);

  const startX = (state.width - cols * cell) / 2 + cell * 0.5;
  const startY = (state.height - rows * cell) / 2 + cell * 0.5;

  let visibleCount = 0;

  for (let y = 0; y < rows; y++) {
    const line = state.lines[y];
    for (let x = 0; x < cols; x++) {
      const ch = line[x] || " ";
      if (ch !== " ") {
        visibleCount++;
      }
    }
  }

  const sampled = visibleCount > state.maxParticles;
  const baseChance = sampled ? state.maxParticles / visibleCount : 1;
  const targets = [];

  for (let y = 0; y < rows; y++) {
    const line = state.lines[y];

    for (let x = 0; x < cols; x++) {
      const ch = line[x] || " ";
      if (ch === " ") continue;

      const weight = densityMap[ch] ?? 0.5;
      const chance = sampled ? Math.min(1, baseChance * (0.38 + weight * 1.45)) : 1;

      if (sampled && stableNoise(x + 13, y + 7) > chance) {
        continue;
      }

      targets.push({
        x: startX + x * cell,
        y: startY + y * cell,
        size: Math.max(0.75, Math.min(2.25, 0.75 + weight * 1.6)),
        alpha: 0.25 + weight * 0.75
      });
    }
  }

  if (targets.length > state.maxParticles) {
    targets.length = state.maxParticles;
  }

  morphParticles(targets);
}

function animate() {
  const time = performance.now() * 0.001;
  updateAudioMetrics();
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = "rgba(3, 7, 14, 0.30)";
  ctx.fillRect(0, 0, state.width, state.height);

  const mouseRadius = 90;
  const mouseRadiusSq = mouseRadius * mouseRadius;
  const mouse = state.mouse;
  const audioLevel = getAudioIntensity();
  const audioBeat = getAudioBeatPulse();
  const shapeLoss = easeOutCubic(getShapeLoss());
  const jitterLimit = SETTINGS.audioMaxJitter * (0.28 + audioLevel * 0.92);
  const cohesionLoss = SETTINGS.audioShapeLoss * shapeLoss;

  ctx.fillStyle = "#f4f7fb";

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];

    const audioWarp = easeOutCubic(audioLevel * 0.7 + audioBeat * 0.3);
    const deformStrength = jitterLimit * audioWarp;
    const deformX = Math.sin(time * mix(6.2, 11.5, audioLevel) + i * 0.17 + p.y * 0.03) * deformStrength;
    const deformY = Math.cos(time * mix(4.6, 9.5, audioLevel) + i * 0.13 + p.x * 0.02) * deformStrength * 0.72;
    const targetX = p.tx + deformX;
    const targetY = p.ty + deformY;

    let ax = (targetX - p.x) * mix(0.018, 0.006, cohesionLoss);
    let ay = (targetY - p.y) * mix(0.018, 0.006, cohesionLoss);

    if (!isAsciiTransitionActive()) {
      const windPhase = time * SETTINGS.windSpeed;
      const windBoost = 1 + audioLevel * 0.8;
      const swayX = Math.sin(windPhase + p.y * SETTINGS.windScale * 3.0) * SETTINGS.windStrength * windBoost;
      const swayY = Math.cos(windPhase * 0.75 + p.x * SETTINGS.windScale * 2.2) * SETTINGS.windStrength * 0.28 * windBoost;
      ax += swayX;
      ay += swayY;
    }

    if (audioLevel > 0.02 || audioBeat > 0.02) {
      const noise = stableNoise3(i * 0.07, time * 1.4, p.x * 0.005 + p.y * 0.003);
      const burst = (noise - 0.5) * 2 * jitterLimit * (0.18 + audioLevel * 0.82);
      ax += burst * (0.55 + audioBeat * 0.8);
      ay += -burst * (0.35 + audioLevel * 0.45);

      const centerDx = p.x - state.width * 0.5;
      const centerDy = p.y - state.height * 0.5;
      const centerDistance = Math.max(1, Math.hypot(centerDx, centerDy));
      const repel = (audioLevel + audioBeat * 0.7) * SETTINGS.audioRepelStrength;
      ax += (centerDx / centerDistance) * repel;
      ay += (centerDy / centerDistance) * repel;
    }

    if (mouse.active) {
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < mouseRadiusSq && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const force = (1 - dist / mouseRadius) * 1.35;
        ax += (dx / dist) * force;
        ay += (dy / dist) * force;
      }
    }

    const drag = mix(0.86, 0.78, audioLevel);
    p.vx = (p.vx + ax) * drag;
    p.vy = (p.vy + ay) * drag;
    p.x += p.vx;
    p.y += p.vy;

    const sizeTarget = p.targetSize * mix(1, 1.22, audioLevel * 0.85 + audioBeat * 0.2);
    const alphaTarget = p.targetAlpha * mix(1, 0.68, shapeLoss * 0.82);
    p.size += (sizeTarget - p.size) * mix(0.09, 0.16, audioLevel);
    p.alpha += (alphaTarget - p.alpha) * mix(0.06, 0.1, audioLevel);

    ctx.globalAlpha = p.alpha;
    ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
  }

  ctx.globalAlpha = 1;
  requestAnimationFrame(animate);
}

function generateTextAscii(text = "ASCII", cols = 180, rows = 60) {
  const off = document.createElement("canvas");
  off.width = cols * 8;
  off.height = rows * 10;

  const octx = off.getContext("2d", { willReadFrequently: true });

  octx.fillStyle = "black";
  octx.fillRect(0, 0, off.width, off.height);

  let fontSize = off.height * 0.68;
  octx.font = `bold ${fontSize}px monospace`;

  while (octx.measureText(text).width > off.width * 0.88 && fontSize > 10) {
    fontSize -= 8;
    octx.font = `bold ${fontSize}px monospace`;
  }

  octx.textAlign = "center";
  octx.textBaseline = "middle";
  octx.fillStyle = "white";
  octx.fillText(text, off.width / 2, off.height / 2);

  const image = octx.getImageData(0, 0, off.width, off.height).data;
  const lines = [];

  for (let y = 0; y < rows; y++) {
    let line = "";

    for (let x = 0; x < cols; x++) {
      const px = Math.floor(((x + 0.5) / cols) * off.width);
      const py = Math.floor(((y + 0.5) / rows) * off.height);
      const idx = (py * off.width + px) * 4;
      const brightness = image[idx];

      if (brightness < 18) {
        line += " ";
        continue;
      }

      const normalized = brightness / 255;
      const paletteIndex = Math.max(
        0,
        Math.min(palette.length - 1, Math.floor((1 - normalized) * (palette.length - 1)))
      );

      line += palette[paletteIndex];
    }

    lines.push(line);
  }

  return lines.join("\n");
}

function normalizeAsciiPath(path) {
  if (!path) return "";
  const clean = path.trim().replace(/^\.\//, "");
  if (clean.startsWith(`${SETTINGS.asciiDir}/`)) {
    return clean;
  }
  return `${SETTINGS.asciiDir}/${clean}`;
}

async function fetchAsciiListFromJson() {
  const response = await fetch(`${SETTINGS.asciiDir}/index.json`, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item) => typeof item === "string" && item.toLowerCase().endsWith(".txt"))
    .map(normalizeAsciiPath);
}

async function fetchAsciiListFromDirectory() {
  const response = await fetch(`${SETTINGS.asciiDir}/`, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const links = [];
  const regex = /href=["']([^"']+\.txt)["']/gi;
  let match = regex.exec(html);

  while (match) {
    links.push(normalizeAsciiPath(decodeURIComponent(match[1])));
    match = regex.exec(html);
  }

  return links;
}

function uniqueSorted(items) {
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

function sameList(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function refreshAsciiList() {
  if (state.loadingList || !state.scanningEnabled) {
    return;
  }

  state.loadingList = true;

  try {
    let files = await fetchAsciiListFromJson();

    if (!files.length) {
      files = await fetchAsciiListFromDirectory();
    }

    files = uniqueSorted(files);

    if (!files.length) {
      return;
    }

    const previousCurrent = state.asciiFiles[state.currentAsciiIndex] || null;

    if (!sameList(state.asciiFiles, files)) {
      state.asciiFiles = files;

      if (previousCurrent) {
        const foundIndex = state.asciiFiles.indexOf(previousCurrent);
        state.currentAsciiIndex = foundIndex;
      }

      if (state.currentAsciiIndex < 0 || state.currentAsciiIndex >= state.asciiFiles.length) {
        state.currentAsciiIndex = 0;
      }
    }
  } catch {
    state.scanningEnabled = false;
  } finally {
    state.loadingList = false;
  }
}

async function loadAsciiFromPath(path) {
  if (state.loadingAscii) {
    return false;
  }

  state.loadingAscii = true;

  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      return false;
    }

    const text = await response.text();
    setAscii(text);
    return true;
  } catch {
    return false;
  } finally {
    state.loadingAscii = false;
  }
}

async function showCurrentAscii() {
  if (!state.asciiFiles.length) {
    return false;
  }

  const currentPath = state.asciiFiles[state.currentAsciiIndex];
  return loadAsciiFromPath(currentPath);
}

async function rotateAscii() {
  await refreshAsciiList();

  if (!state.asciiFiles.length) {
    return false;
  }

  state.currentAsciiIndex = (state.currentAsciiIndex + 1) % state.asciiFiles.length;
  return showCurrentAscii();
}

async function bootstrapAsciiSource() {
  await refreshAsciiList();

  if (state.asciiFiles.length) {
    state.currentAsciiIndex = 0;
    const loaded = await showCurrentAscii();
    if (loaded) {
      return;
    }
  }

  const fallback = generateTextAscii("ASCII", 180, 60);
  setAscii(fallback);
}

canvas.addEventListener("mousemove", (event) => {
  state.mouse.x = event.clientX;
  state.mouse.y = event.clientY;
  state.mouse.active = true;
});

canvas.addEventListener("mouseleave", () => {
  state.mouse.active = false;
});

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (!event.touches[0]) return;
    state.mouse.x = event.touches[0].clientX;
    state.mouse.y = event.touches[0].clientY;
    state.mouse.active = true;
  },
  { passive: true }
);

canvas.addEventListener("touchend", () => {
  state.mouse.active = false;
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
bootstrapAsciiSource();
startWallpaperEngineAudio();
requestAudioStartOnGesture();

setInterval(() => {
  refreshAsciiList();
}, SETTINGS.rescanIntervalMs);

setInterval(() => {
  rotateAscii();
}, SETTINGS.rotateIntervalMs);

animate();
