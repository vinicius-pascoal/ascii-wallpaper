const palette = "@%#*+=-:.";
const densityMap = {
  "@": 1.00,
  "%": 0.92,
  "#": 0.84,
  "*": 0.72,
  "+": 0.58,
  "=": 0.46,
  "-": 0.32,
  ":": 0.20,
  ".": 0.12
};

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const fileInput = document.getElementById("fileInput");
const asciiInput = document.getElementById("asciiInput");
const renderBtn = document.getElementById("renderBtn");
const demoBtn = document.getElementById("demoBtn");
const scatterBtn = document.getElementById("scatterBtn");
const particleRange = document.getElementById("particleRange");
const particleCountLabel = document.getElementById("particleCountLabel");
const statusEl = document.getElementById("status");

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  rawText: "",
  lines: [],
  particles: [],
  maxParticles: Number(particleRange.value),
  mouse: {
    x: 0,
    y: 0,
    active: false
  },
  lastMeta: {
    rows: 0,
    cols: 0,
    visible: 0,
    rendered: 0,
    sampled: false
  }
};

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
}

function buildTargets() {
  if (!state.lines.length) {
    state.particles.length = 0;
    state.lastMeta = {
      rows: 0,
      cols: 0,
      visible: 0,
      rendered: 0,
      sampled: false
    };
    updateStatus();
    return;
  }

  const rows = state.lines.length;
  const cols = Math.max(...state.lines.map(line => line.length), 1);

  const areaW = state.width * 0.88;
  const areaH = state.height * 0.80;
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
      const chance = sampled
        ? Math.min(1, baseChance * (0.38 + weight * 1.45))
        : 1;

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

  state.lastMeta = {
    rows,
    cols,
    visible: visibleCount,
    rendered: targets.length,
    sampled
  };

  updateStatus();
}

function updateStatus() {
  const meta = state.lastMeta;
  statusEl.innerHTML = `
    Grade: <strong>${meta.cols} x ${meta.rows}</strong><br>
    Pontos visíveis no ASCII: <strong>${meta.visible.toLocaleString("pt-BR")}</strong><br>
    Partículas renderizadas: <strong>${meta.rendered.toLocaleString("pt-BR")}</strong><br>
    Amostragem ativa: <strong>${meta.sampled ? "sim" : "não"}</strong>
  `;
}

function scatterParticles() {
  for (const p of state.particles) {
    const spawn = randomSpawn();
    p.x = spawn.x;
    p.y = spawn.y;
    p.vx = (Math.random() - 0.5) * 8;
    p.vy = (Math.random() - 0.5) * 8;
  }
}

function animate() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = "rgba(3, 7, 14, 0.30)";
  ctx.fillRect(0, 0, state.width, state.height);

  const mouseRadius = 90;
  const mouseRadiusSq = mouseRadius * mouseRadius;
  const mouse = state.mouse;

  ctx.fillStyle = "#f4f7fb";

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];

    let ax = (p.tx - p.x) * 0.018;
    let ay = (p.ty - p.y) * 0.018;

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

    p.vx = (p.vx + ax) * 0.86;
    p.vy = (p.vy + ay) * 0.86;
    p.x += p.vx;
    p.y += p.vy;

    p.size += (p.targetSize - p.size) * 0.09;
    p.alpha += (p.targetAlpha - p.alpha) * 0.06;

    ctx.globalAlpha = p.alpha;
    ctx.fillRect(
      p.x - p.size * 0.5,
      p.y - p.size * 0.5,
      p.size,
      p.size
    );
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
      const px = Math.floor((x + 0.5) / cols * off.width);
      const py = Math.floor((y + 0.5) / rows * off.height);
      const idx = (py * off.width + px) * 4;
      const brightness = image[idx];

      if (brightness < 18) {
        line += " ";
        continue;
      }

      const normalized = brightness / 255;
      const paletteIndex = Math.max(
        0,
        Math.min(
          palette.length - 1,
          Math.floor((1 - normalized) * (palette.length - 1))
        )
      );

      line += palette[paletteIndex];
    }

    lines.push(line);
  }

  return lines.join("\n");
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const content = String(reader.result || "");
    asciiInput.value = content;
    setAscii(content);
  };
  reader.readAsText(file, "utf-8");
});

renderBtn.addEventListener("click", () => {
  setAscii(asciiInput.value);
});

demoBtn.addEventListener("click", () => {
  const demo = generateTextAscii("ASCII", 180, 60);
  asciiInput.value = demo;
  setAscii(demo);
});

scatterBtn.addEventListener("click", () => {
  scatterParticles();
});

asciiInput.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") {
    setAscii(asciiInput.value);
  }
});

particleRange.addEventListener("input", () => {
  state.maxParticles = Number(particleRange.value);
  particleCountLabel.textContent = particleRange.value;
  buildTargets();
});

canvas.addEventListener("mousemove", (event) => {
  state.mouse.x = event.clientX;
  state.mouse.y = event.clientY;
  state.mouse.active = true;
});

canvas.addEventListener("mouseleave", () => {
  state.mouse.active = false;
});

canvas.addEventListener("touchmove", (event) => {
  if (!event.touches[0]) return;
  state.mouse.x = event.touches[0].clientX;
  state.mouse.y = event.touches[0].clientY;
  state.mouse.active = true;
}, { passive: true });

canvas.addEventListener("touchend", () => {
  state.mouse.active = false;
});

window.addEventListener("resize", resizeCanvas);

particleCountLabel.textContent = particleRange.value;
resizeCanvas();

const initialDemo = generateTextAscii("ASCII", 180, 60);
asciiInput.value = initialDemo;
setAscii(initialDemo);

animate();
