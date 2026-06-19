# Pixel — Brand Book (extraído do Manual de Identidade oficial)

**Versão:** 2.0 · **Data:** 2026-06-19 · **Status:** canônico
**Fonte:** `Manual de Identidade.pdf` (oficial, brandpack) — extração fiel em texto+código.
**Assets binários:** `Second-Brain-Amora COS/memory/assets/pixel-educacao/brandpack/` (fontes, logos SVG, social kit).

> **TL;DR:** sistema editorial em papel off-white `#F2F1ED`. Título em **Carbona** (sans arredondada), texto em **Articulat CF**, e **Roca** (serif) só como destaque pontual. Quatro famílias de cor: **Núcleo** azul ancora · **Impulso** laranja é o accent · **Conexão** lilás conecta · **Sistema** neutros. Logo = símbolo de pontos + "pixel" lowercase.

---

## 1. Conceito da marca

A Pixel Educação é um **Sistema Vivo de aprendizagem empreendedora**, baseado na lógica do **Atomic Design**: cada empreendedor é uma unidade viva, cada etapa é uma camada de complexidade, a soma das partes gera um ecossistema que evolui. *"Pixel é a menor unidade de uma imagem digital. Isolado parece pequeno; combinado, compõe algo maior."*

Jornada do público (atomic): **Átomo** (início — ganha forma) → **Molécula** (em movimento — ganha consistência) → **Organismo** (tração — ganha potência).

Atributos: clara · modular · inteligente · energética · confiável · atual · premium sem ser fria.

---

## 2. Posição da identidade (resolvendo o caos de marca)

Existe **uma** identidade Pixel Educação: a deste manual (editorial clara). Os sistemas dark documentados em outros docs são legado/marcas distintas — **não usar para Pixel Educação**:

| Sistema | Onde | Status |
|---|---|---|
| **Editorial claro** (este book) | Manual de Identidade oficial | ✅ **canônico** |
| Dark/Inter `#0A0A14` | `carrossel-design-spec.md` | ⚠️ legado — migrar |
| Dark/Inter `#ff751f` | `carrossel/references/` (skill) | ⚠️ produção — migrar |
| Dark roxo `#05030E` | `pixel-educacao-branding.md` | ⚠️ legado **Micro-SaaS PRO** (nome enganoso) |
| Dark/roxo/âmbar | `brand-identity.md` | ➡️ outra marca: **Pixel AI Agency** |

> Nota sobre o carrossel @techwith.ram que serviu de referência: o **layout/composição** (off-white, sparkle, bullets-em-círculo, dashboard, underline) é adotável; a **tipografia serif** dele **não** é Pixel — nos títulos usa-se **Carbona**, com **Roca** apenas em um destaque pontual.

---

## 3. Cores (valores oficiais do manual)

```css
:root {
  /* NÚCLEO — azul, ancora institucional (Pantone 2747 C) */
  --nucleo:        #101C7E;   /* base, títulos institucionais, logo formal */
  --nucleo-2:      #2D3BAB;
  --nucleo-3:      #606FEF;

  /* IMPULSO — laranja, O accent (Pantone Orange 021 C) */
  --impulso:       #FE5000;   /* CTA, números, ênfase, sparkle, underline */
  --impulso-2:     #CC4100;   /* hover/press */
  --impulso-3:     #FFA38D;   /* fundo suave */

  /* CONEXÃO — lilás, conecta/comunidade (Pantone 2641 C) */
  --conexao:       #D8B3FD;
  --conexao-2:     #C986F6;
  --conexao-3:     #7C50B1;

  /* SISTEMA — neutros (Pantone White) */
  --canvas:        #F2F1ED;   /* fundo papel — NUNCA branco puro */
  --neutro-2:      #DFDFDF;   /* divisórias */
  --neutro-3:      #C5C5C5;   /* bordas, inativos */

  /* Texto (derivado) */
  --ink:           #3D3D3A;   /* texto e títulos de conteúdo (grafite quente) */
  --muted:         #6C6A64;   /* legendas, rodapé */
}
```

| Família | Hex | Pantone | RGB |
|---|---|---|---|
| **Núcleo** | `#101C7E` · `#2D3BAB` · `#606FEF` | 2747 C | 16 28 126 |
| **Impulso** | `#FE5000` · `#CC4100` · `#FFA38D` | Orange 021 C | 254 80 0 |
| **Conexão** | `#D8B3FD` · `#C986F6` · `#7C50B1` | 2641 C | 216 179 253 |
| **Sistema** | `#F2F1ED` · `#DFDFDF` · `#C5C5C5` | White | 242 241 237 |

**Regra 60-30-10:** 60% canvas off-white · 30% texto/azul Núcleo · **10% laranja Impulso** (onde o olho cai). Conexão (lilás) entra como apoio fora dos 10%, nunca protagonista. **1 momento laranja por slide.** Nunca branco puro dominante; nunca cor fora desta paleta.

---

## 4. Tipografia (papéis oficiais)

| Papel | Fonte | Caráter | Fallback web |
|---|---|---|---|
| **Títulos** (principal) | **Carbona** | sans grotesk, terminações suavemente arredondadas — "dinâmica, contemporânea, ecossistema em movimento" | Hanken Grotesk · Onest · Inter |
| **Textos** (secundária) | **Articulat CF** | sans neutra, legível, estável | Inter · -apple-system |
| **Apoio** (terciária) | **Roca** | serif elegante e fluida — **contraste e expressão pontual**, quebra a rigidez. Nunca o display inteiro. | Fraunces · Cormorant Garamond |
| Mono (terminal) | Carbona Mono | monoespaçada da família | JetBrains Mono |

> **A regra que eu tinha errado:** título = **Carbona** (sans), **não** Roca. Roca aparece em **uma** linha de destaque pontual ("Quero fazer parte da próxima fase."), nunca como a fonte do título principal.

**Escala modular** (ratio 1.333, base 20px, arredondada ao grid 8pt): `20 · 28 · 36 · 48 · 64 · 84 · 112 px` — máx 4 tamanhos por slide.
- Title slide 64–112px · Subhead 28–36px · Body 20–24px · Caption/rodapé 14–18px.
- Line-height: display 1.0–1.2 · body 1.4–1.6. Tracking display −0.01 a −0.02em.

Arquivos reais: `brandpack/Fontes/Carbona/Carbona-*.otf` (Regular/Medium/Black + Mono), `Fontes/Articulat CF/`, `Fontes/Roca/.5388x.otf` (dotfiles).

---

## 5. Logo

Composto por **símbolo** (cluster de pontos de tamanhos variados em laranja, formando um adensamento radial — a metáfora "partes que formam o todo") + **marca nominativa** "pixel" lowercase. Podem ser usados juntos ou separados.

- **Redução mínima:** 8mm / 80px (abaixo disso perde legibilidade).
- **Sobre `--canvas`:** versão laranja Impulso ou Núcleo. **Sobre dark:** versão off-white.
- **Em slide:** wordmark pequeno bottom-left na safe-zone (≈24px). Nunca placeholder.

**Usos incorretos (do manual):** não alterar cor pra fora da paleta · não aplicar sobre fundo carregado/sem contraste · não alterar a proporção símbolo↔nominativa · não usar versão outline · não trocar a tipografia da nominativa · não distorcer/deformar.

Assets: `brandpack/Logotipo/SVG/{SVG - Símbolo, SVG - Logotipo, SVG - Assinatura}/`.

---

## 6. Grid & espaçamento (8pt)

- **Canvas:** 1080×1080 (carrossel) · 1080×1350 (IG retrato) · 1920×1080 (deck 16:9).
- **Safe-zone** 5% nas bordas · **spacing** múltiplos de 8 (`8·16·24·32·48·64·96·128`).
- **Relacionados** ≤16px · **não relacionados** ≥48px · **cards** padding 32px, radius 16–20px, gap ≥24px.
- **Whitespace** ≥40% conteúdo, ≥60% capa. Composição modular, arejada, muito espaço negativo.

---

## 7. Componentes do sistema editorial

(Layout adotado do carrossel de referência, **com a tipografia Pixel** — Carbona nos títulos.)

1. **Label de seção** — `Slide N — Tema` em Carbona/Articulat bold, `--impulso`, + underline laranja curto.
2. **Headline** — **Carbona** bold, `--nucleo` ou `--ink`, 2 linhas, com sparkle "+" `--impulso` ao lado.
3. **Sparkle "+"** — estrela 4 pontas `--impulso`, 1–2 por slide.
4. **Destaque Roca** — UMA frase de ênfase em Roca serif para contraste pontual (não o título).
5. **Bullet com ícone** — ícone linear em círculo `--neutro-2`/bege + texto; palavra-chave em `--impulso`.
6. **Underline à mão** — traço `--impulso` irregular sob palavra-chave.
7. **Doodles de fundo** — linha fina a ~15% opacidade (gráfico, lâmpada, browser, setas pontilhadas).
8. **Dot-grid** — matriz de pontinhos (ecoa o símbolo) no canto.
9. **Diagrama fluxo/ciclo** — nós em círculo com ícones + setas; "Human" no centro.
10. **Card dashboard dark** — janela mac, métricas com barras `--impulso`. Único uso de superfície escura.
11. **Gráfico** — linha `--impulso` + fill gradient, data-ink ≥80%, sem 3D/sombra.
12. **Quote/callout** — barra lateral `--impulso` + palavra-chave laranja.
13. **Rodapé** — handle/assinatura + logo Pixel na safe-zone.

---

## 8. Do & Don't

**Do:** papel off-white respira · **Carbona** nos títulos · laranja Impulso pontual (10%, 1/bloco) · Roca só num destaque · azul Núcleo ancora · diagrama/visual antes de bullets · sparkle e underline à mão pra humanizar · dark só em mockup de produto.

**Don't:** branco puro dominante · dark-SaaS roxo (é Micro-SaaS legado) · **serif no título** (Roca é só apoio) · cor fora da paleta · dois accents brigando · seis bullets · gradient radial forte · sombra em gráfico · logo outline/distorcido/sobre fundo carregado · emoji como header.

---

## 9. Aplicações

| Contexto | Canvas | Título | Texto | Apoio |
|---|---|---|---|---|
| Carrossel LinkedIn/IG | off-white | Carbona | Articulat CF | Roca pontual |
| Deck 16:9 / report | off-white | Carbona | Articulat CF | Roca pontual |
| Thumbnail YouTube | alto contraste | Carbona | — | — |

*Extração fiel do Manual de Identidade oficial (8 seções: A Pixel · Logotipo · Versões · Variações Cromáticas · Área de Proteção · Redução · Usos Incorretos · Cores · Tipografia · Aplicações). Assets binários no brandpack do cérebro.*
