import { ctx, easeOutCubic, mix, SETTINGS, stableNoise3, state } from "./core.js";
import { getAudioBeatPulse, getAudioIntensity, getShapeLoss, updateAudioMetrics } from "./audio.js";
import { isAsciiTransitionActive } from "./ascii.js";

export function animate() {
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
