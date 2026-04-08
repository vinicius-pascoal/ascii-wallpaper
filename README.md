# ASCII Particle Morph

Um wallpaper animado que transforma arte ASCII em partículas fluidas, alternando automaticamente entre múltiplos designs. As partículas se movem fluidamente formando o padrão de cada ASCII, com interação de mouse.

## ✨ Características

- **Renderização de partículas**: Converte caracteres ASCII em pequenas partículas que formam a imagem
- **Transições fluidas**: As partículas se movem suavemente entre diferentes padrões ASCII
- **Rotação automática**: Alterna entre ASCIIs a intervalos regulares
- **Detecção dinâmica**: Reconhece automaticamente novos arquivos na pasta `asciis/`
- **Interatividade**: Mouse afasta partículas próximas (opcional com toque)
- **Sem UI**: Interface limpa pura, apenas na plataforma de exibição
- **Responsivo**: Adapta-se automaticamente ao tamanho da tela

## 🚀 Como usar

### Requisitos
- Servidor Web local (HTTP)
- Navegador moderno com suporte a Canvas 2D

### Instalação rápida

1. Clone ou baixe o projeto
2. Inicie um servidor Web na raiz do projeto:

```bash
# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server

# PHP
php -S localhost:8000
```

3. Acesse `http://localhost:8000` no navegador

### Adicionar novos ASCIIs

1. Crie um arquivo `.txt` na pasta `asciis/` com seu ASCII art
2. Atualize o arquivo `asciis/index.json` para incluir o novo arquivo:

```json
[
  "diamond.txt",
  "meu-novo-ascii.txt",
  "spectrum.txt",
  "waves.txt"
]
```

3. Recarregue a página — o novo ASCII será detectado na próxima rotação

## ⚙️ Configuração

Edite as definições em `script.js` (linhas 14-19):

```javascript
const SETTINGS = {
  asciiDir: "asciis",           // Pasta com arquivos .txt
  maxParticles: 18000,          // Limite de partículas
  rotateIntervalMs: 10000,      // Intervalo entre trocas (ms)
  rescanIntervalMs: 15000       // Intervalo para verificar novos arquivos (ms)
};
```

### Ajustes comuns

| Configuração | Valor | Efeito |
|---|---|---|
| `maxParticles` | 8000 | Máquinas fracas, menos detalhes |
| `maxParticles` | 25000 | Máquinas potentes, mais partículas |
| `rotateIntervalMs` | 5000 | Troca rápida (5s) |
| `rotateIntervalMs` | 20000 | Troca lenta (20s) |

## 📁 Estrutura do projeto

```
ascii-wallpaper/
├── index.html           # Página principal
├── styles.css           # Estilos (fundo, canvas)
├── script.js            # Lógica principal
├── asciis/
│   ├── index.json       # Lista de arquivos ASCII
│   ├── diamond.txt      # Exemplo
│   ├── spectrum.txt     # Exemplo
│   └── waves.txt        # Exemplo
└── README.md            # Este arquivo
```

## 🎨 Criando ASCIIs personalizados

### Formato esperado
- Arquivo de texto puro (`.txt`)
- Caracteres recomendados: `@%#*+=-:.` (densidade alta a baixa)
- Sem limite de tamanho, mas 50-200 colunas é ideal

### Exemplo simples

```text
  @@@
 @% %@
@%   %@
@%   %@
 @% %@
  @@@
```

### Dica
- Use `@` e `%` para áreas densas
- Use `#`, `*`, `+`, `=` para meios-tons
- Use `-`, `:`, `.` para áreas claras
- Espaços em branco (vazio) não geram partículas

## 🖱️ Controles

- **Mouse**: Mova para repelir partículas próximas
- **Toque**: Funciona em dispositivos móveis
- **Sem controles UI**: Wallpaper puro e limpo

## 🔧 Técnicos

### Densidade de caracteres
Cada símbolo mapeia para um nível de opacidade/tamanho:

```javascript
"@": 1.00,   // Muito denso
"%": 0.92,
"#": 0.84,
"*": 0.72,
"+": 0.58,
"=": 0.46,
"-": 0.32,
":": 0.20,
".": 0.12    // Pouco denso
```

### Algoritmo de morph
1. Cada ASCII é convertido em alvo de posição + tamanho
2. Partículas se movem via **aceleração** (suave, não instantâneo)
3. Ao rotar, as mesmas partículas ajustam alvos
4. Sem recriação, apenas realocação — transição fluida

### Amostragem inteligente
Se o ASCII tem muitos pontos que `maxParticles`, o script:
- Seleciona pontos distribuídos via ruído estável
- Prioriza caracteres densos (`@`, `%`)
- Mantém padrão visual mesmo subamostrado

## 📊 Performance

- **FPS típico**: 60 FPS em máquinas modernas
- **GPU**: Usa Canvas 2D (CPU), sem WebGL
- **Memória**: ~50-80 MB com 18k partículas
- **Escalabilidade**: Reduz `maxParticles` para devices fracos

## 📝 Licença

Este projeto está disponível para uso livre.

## 💡 Próximas melhorias

- [ ] Cache de targets para ASCIIs (menos recálculo)
- [ ] Playlist sem repetição automática
- [x] Efeito de vento suave fora das transições
- [ ] Sincronização com áudio
- [ ] Manifest com duração customizada por arquivo

## 👥 Contribuições

Contribua com novos ASCIIs interessantes! Adicione na pasta `asciis/` e atualize o `index.json`.
