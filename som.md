# Guia de Responsividade de Som (Web + Wallpaper Engine)

Este guia ensina a reaproveitar a responsividade de som (equalizador, detecção de batida/BPM e efeitos visuais) em projetos Web comuns ou no Wallpaper Engine.

---

## Visão Geral

- Equalizador com `N` barras que reagem ao áudio (FFT).
- Detecção de batida (graves) com cálculo de BPM e animação `beat`.
- Integração por três fontes de áudio: Wallpaper Engine, microfone (Web Audio) ou elemento `<audio>`.

---

## HTML mínimo

```html
<!-- Contêiner do equalizador -->
<div id="audioEqualizer" aria-hidden="true"></div>

<!-- Opcional: alvo visual para efeito de graves -->
<img id="mountainsImage" src="imgs/mountains.svg" alt="Montanhas" />
```

## CSS mínimo

```css
#audioEqualizer {
    position: fixed;
    inset: auto 0 5vh 0; /* base inferior */
    display: flex;
    justify-content: center;
    gap: 6px;
    pointer-events: none;
}

.audio-bar {
    width: 10px;
    height: 1vh;          /* altura base quase invisível */
    background: linear-gradient(to top, #3aa0ff, #7de3ff);
    border-radius: 4px;
    transform-origin: bottom;
    transform: scaleY(0);  /* sem som = invisível */
    opacity: 0;            /* aparece com som */
    transition: opacity 80ms linear; /* suavização visual */
}

/* Animação global ativada em batidas */
body.beat {
    animation: pulse 160ms ease-out;
}

@keyframes pulse {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.02); }
    100% { transform: scale(1); }
}
```

---

## JS – Módulo reutilizável

O módulo abaixo cria barras, suaviza valores de áudio, detecta batidas (BPM) e aplica efeitos. Você pode alimentar com FFT do Wallpaper Engine, microfone ou `<audio>`.

```js
class SoundResponsiveEqualizer {
    constructor({
        containerId = 'audioEqualizer',
        barCount = 128,
        beatThreshold = 0.12,
        beatCooldownMs = 300,
        onBeat = () => {
            document.body.classList.remove('beat');
            void document.body.offsetWidth;
            document.body.classList.add('beat');
        },
        bassTargetId = 'mountainsImage' // opcional
    } = {}) {
        this.equalizer = document.getElementById(containerId);
        this.barCount = barCount;
        this.threshold = beatThreshold;
        this.beatCooldown = beatCooldownMs;
        this.onBeat = onBeat;
        this.bassTarget = bassTargetId ? document.getElementById(bassTargetId) : null;

        this.bars = [];
        this.smooth = new Array(barCount).fill(0);
        this.lastBeatTime = 0;
        this.bpm = 0;
        this.bassSmooth = 0;

        this._createBars();
    }

    _createBars() {
        for (let i = 0; i < this.barCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'audio-bar';
            this.equalizer.appendChild(bar);
            this.bars.push(bar);
        }
    }

    // Alimenta o equalizador com um array de FFT (0..1)
    update(audioArray) {
        const n = this.barCount;
        for (let i = 0; i < n; i++) {
            const idx = Math.floor((i / n) * audioArray.length);
            const val = audioArray[idx] || 0;
            // suavização
            this.smooth[i] = this.smooth[i] * 0.8 + val * 0.2;
            const s = this.smooth[i];
            const scale = Math.min(s * 6, 8);
            this.bars[i].style.transform = `scaleY(${scale})`;
            this.bars[i].style.opacity = Math.min(s * 3, 1);
        }

        // graves + batida/BPM
        let bass = 0;
        const bassBins = Math.min(8, audioArray.length);
        for (let i = 0; i < bassBins; i++) bass += audioArray[i];
        bass /= bassBins;
        this.bassSmooth = this.bassSmooth * 0.8 + bass * 0.2;

        const now = performance.now();
        if (this.bassSmooth > this.threshold && now - this.lastBeatTime > this.beatCooldown) {
            const interval = now - this.lastBeatTime;
            this.lastBeatTime = now;
            if (interval > 0) this.bpm = Math.round(60000 / interval);
            if (this.bpm > 60 && this.bpm < 200) this.onBeat();
        }

        // efeito visual opcional em alvo (ex.: montanhas)
        if (this.bassTarget) {
            if (this.bassSmooth > this.threshold) {
                const brightness = 1 + (this.bassSmooth * 0.8);
                const shakeX = (Math.random() - 0.5) * 2;
                const shakeY = (Math.random() - 0.5) * 1.5;
                this.bassTarget.style.filter = `brightness(${brightness}) drop-shadow(0 0 10px rgba(0,0,0,.5))`;
                this.bassTarget.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
            } else {
                this.bassTarget.style.filter = 'drop-shadow(0 0 10px rgba(0,0,0,.5))';
                this.bassTarget.style.transform = 'translate(0, 0)';
            }
        }
    }
}
```

---

## Fontes de áudio suportadas

### 1) Wallpaper Engine (FFT)

```js
const eq = new SoundResponsiveEqualizer();

if (window.wallpaperRegisterAudioListener) {
    window.wallpaperRegisterAudioListener((audioArray) => {
        eq.update(audioArray);
    });
}

// Integração com propriedades (opcional)
if (window.wallpaperPropertyListener) {
    window.wallpaperPropertyListener = {
        applyUserProperties: (props) => {
            if (props.audioSensitivity) {
                eq.threshold = props.audioSensitivity.value; // ajustar sensibilidade
            }
        }
    };
}
```

### 2) Microfone (Web Audio API)

```js
async function startMic(eq) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256; // 128 bins de frequência
    const data = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);

    function loop() {
        analyser.getByteFrequencyData(data);
        // normalizar 0..255 -> 0..1
        const arr = Array.from(data, (v) => v / 255);
        eq.update(arr);
        requestAnimationFrame(loop);
    }
    loop();
}

const eq = new SoundResponsiveEqualizer();
startMic(eq);
```

### 3) Elemento `<audio>` (Web Audio API)

```js
async function startAudioElement(eq, audioEl) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audioEl);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const data = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(ctx.destination);

    function loop() {
        analyser.getByteFrequencyData(data);
        const arr = Array.from(data, (v) => v / 255);
        eq.update(arr);
        requestAnimationFrame(loop);
    }
    loop();
}

// Exemplo de uso
const audio = document.querySelector('audio');
audio.src = 'musica.mp3';
audio.crossOrigin = 'anonymous';
audio.play();

const eq = new SoundResponsiveEqualizer();
startAudioElement(eq, audio);
```

---

## Ajustes e boas práticas

- `barCount`: 64–128 costuma ser suficiente; combine com `analyser.fftSize`.
- `threshold`: sensibilidade da batida; ajuste conforme gênero musical.
- `beatCooldownMs`: evita múltiplas batidas muito próximas; 250–350 ms.
- Desative efeitos visuais (brilho/tremulação) se houver enjoo visual ou queda de FPS.
- Em ambientes iOS, a criação do `AudioContext` deve ocorrer após interação do usuário.

---

## Troubleshooting

- Nada reage: verifique permissões de microfone ou `crossOrigin` do `<audio>`.
- Bars travando: reduza `fftSize` ou `barCount`; evite reflows pesados.
- BPM irregular: ajuste `threshold` e `beatCooldownMs`; suavização já ajuda.

---

## Licença e reutilização

Este guia é para uso educativo e reaproveitamento em projetos pessoais. Ajuste os snippets conforme a necessidade do seu layout e pipeline.
