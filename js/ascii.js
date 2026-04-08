import { canvas, ctx, densityMap, palette, SETTINGS, stableNoise, state } from "./core.js";

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

function normalizeText(text) {
  return (text || "")
    .replace(/\r/g, "")
    .replace(/\t/g, "    ")
    .replace(/\n+$/g, "");
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

export function setAscii(text) {
  const normalized = normalizeText(text);
  state.rawText = normalized;
  state.lines = normalized ? normalized.split("\n") : [];
  buildTargets();
  state.transitionUntil = performance.now() + SETTINGS.asciiTransitionMs;
}

export function isAsciiTransitionActive() {
  return performance.now() < state.transitionUntil;
}

export function buildTargets() {
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

export function resizeCanvas() {
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

export async function refreshAsciiList() {
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

export async function rotateAscii() {
  await refreshAsciiList();

  if (!state.asciiFiles.length) {
    return false;
  }

  state.currentAsciiIndex = (state.currentAsciiIndex + 1) % state.asciiFiles.length;
  return showCurrentAscii();
}

export async function bootstrapAsciiSource() {
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
