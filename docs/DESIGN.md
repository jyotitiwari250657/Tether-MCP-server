# Tether Design System — Light Ribbon Theme (Prompt 14, AC-P14-01)

> **Normative.** The token table below is the single source of truth for every
> user-facing surface: extension popup, side panel, web app, and generated brand
> assets. `apps/extension/tailwind.config.js` (extension) and
> `apps/web/src/styles/theme.css` (web) encode these values mechanically.

## 1. The one rule

**All new UI MUST use tokens. Raw hex literals are forbidden in components** and
enforced by `scripts/check-design-tokens.mjs` (wired into `pnpm check`).
Allowlisted files only: `apps/extension/tailwind.config.js`,
`apps/web/src/styles/theme.css`, `apps/extension/components/icons.tsx` (brand
gradient), and `docs/DESIGN.md` itself.

## 2. Color tokens

### Neutrals (light)

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#F3F5F7` | Page background (side panel shell, web body) |
| `surface` | `#FFFFFF` | Cards, popup body, active tab segment |
| `sunken` | `#ECEFF2` | Icon wells, inactive segmented track, mode pill |
| `line` | `#DDE3E8` | Hairline dividers, card borders |
| `line-strong` | `#C4CED8` | Input borders, emphasized strokes |

### Text ramp

| Token | Hex | Usage |
|---|---|---|
| `text-900` | `#22303E` | Primary text, tool names, headings |
| `text-700` | `#3D4C5C` | Secondary text, labels, icon-well glyphs |
| `text-500` | `#6B7A89` | Metadata, refs, timestamps, empty states |

### Brand

| Token | Value | Usage |
|---|---|---|
| brand teal | `#2BB39A` | Gradient start, dot-on |
| brand blue | `#1D6FB8` | Gradient end, solid CTA, Clients value |
| brand gradient | `linear-gradient(135deg,#2BB39A 0%,#1D6FB8 100%)` | Hero text, Confirm button, wordmark |
| brand mid (computed) | `#2491B4` | Gradient midpoint, contrast reference |

### Semantic triads — tint / stroke / fg

Each triad is used as one unit: tint = background, stroke = 1.5px border,
fg = text and icon color.

| Triad | Tint | Stroke | Fg | Applied to |
|---|---|---|---|---|
| teal | `#E7F6F1` | `#9AD8C9` | `#0F8A72` | Reset Kill Switch, READ, ALLOW, IN USE, Verify OK |
| blue | `#EAF2FB` | `#A9C8E8` | `#1D6FB8` | Enable Site Access & Inject, WRITE, Edit, Verify |
| red | `#FCEDEC` | `#E3A6A0` | `#9E2B25` | Kill Switch, DENY, Deny, tamper alerts |
| amber | `#FBF3E4` | `#E7C793` | `#9A6A1F` | ASK, approval cards, OCR-degraded badge, Connecting… |
| violet | `#F0EDFB` | `#C9BFE8` | `#5B4BC4` | SENSITIVE, T3 tier |

### Status dots

| State | Hex | Class |
|---|---|---|
| on / Connected | `#2BB39A` | `bg-dot-on` |
| wait / Connecting… | `#E19A3C` | `bg-dot-wait` |
| off / Not Connected | `#9AA7B4` | `bg-dot-off` |

Dots are 8px markers always paired with an adjacent text label carrying the
same information (WCAG 1.4.1), so they are not sole carriers of state.

### Tier colors (session feed left border)

T0 → teal fg · T1 → blue fg · T2 → amber fg · T3 → violet fg.

## 3. Typography

- **Family:** Inter (sans), JetBrains Mono (mono: hashes, refs, ms, domains).
- **Wordmark:** "Tether", weight 600, uppercase, letter-spacing `.35em`,
  text-900. **Raster-derived**: the mark-as-T lockup is cut from
  `brand/logo-ref.jpg` by `scripts/compose-brand-assets.mjs` and rendered via
  `<img src="/brand-lockup.png">` (40 px popup / 36 px side panel). Never
  synthesize the monogram or wordmark in SVG/CSS — `brand/logo-ref.jpg` is the
  single source of truth (AC-F14-06).
- **Scale:** 17px semibold (row values), 16px semibold (button labels),
  15px (row labels), 12px (pills, secondary), 11px (mono metadata), 10px (badges).

## 4. Radii & elevation

| Token | Value | Usage |
|---|---|---|
| card | 16px | Popup card, t-card, vault well |
| button | 12px | Action buttons, segmented control, feed cards |
| input | 10px | Inputs, icon wells, audit rows |
| pill | 999px | Verdict/level/status pills, mode pill |

**Card shadow:** `0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.08)`
(tailwind `shadow-card`, CSS `--t-shadow-card`).

## 5. Component recipes

- **Action button (popup, 52px):** `rounded-button border-[1.5px] bg-<x>-tint
  border-<x>-stroke text-<x>-fg text-base font-semibold` + 20px stroke icon;
  hover `brightness(0.96)`, active `translateY(1px)`.
- **Pill:** `rounded-pill border bg-<x>-tint text-<x>-fg text-[10px] font-bold`.
- **Card:** `rounded-[10-12px] border border-line bg-surface shadow-card`.
- **Status dot:** `w-2 h-2 rounded-full bg-dot-<state>`.
- **Segmented tab:** sunken track `rounded-button bg-sunken p-1`, active
  segment `bg-surface text-text-900 shadow-card rounded-[8px]`.
- **Gradient CTA:** `bg-brand-gradient text-white font-semibold rounded-button`
  (web Confirm button).

## 6. Do / Don't

**Do**

- Compose colors only from the tokens above (triads as units).
- Keep visible strings and aria-labels untouched when re-styling (PRD §14).
- Pair every status dot with a text label.
- Use `font-mono` for hashes, refs, domains, and ms values.

**Don't**

- Don't introduce raw hex in components (lint-enforced).
- Don't re-use a triad for a different semantic (red = destructive only).
- Don't put white text on tint backgrounds or dark text on the gradient.
- Don't add new neutrals outside the ramp; use opacity, not new grays.

## 7. Contrast (measured, WCAG 2.1)

| Pair | Ratio | Tier |
|---|---|---|
| text-900 / bg | 12.1:1 | AA normal |
| text-700 / surface | 8.3:1 | AA normal |
| text-500 / surface | 4.40:1 | ≥3:1 (1.4.11); 11px labels |
| fg.red / tint.red | 5.7:1 | AA normal |
| fg.blue / tint.blue | 4.6:1 | AA normal |
| fg.violet / tint.violet | 5.1:1 | AA normal |
| fg.teal / tint.teal | 3.85:1 | ≥3:1; 16px semibold (large-text AA) |
| fg.amber / tint.amber | 4.27:1 | ≥3:1 (1.4.11) |
| white / brand-blue solid | 5.0:1 | AA normal |
| white / gradient mid | 3.63:1 | ≥3:1; gradient CTAs ≥16px semibold |
| dot on/wait/off / surface | 2.62 / 2.36 / 2.45 | redundant with text label (1.4.1) |

Normative source of ratios: `apps/extension/test/ui/contrast.spec.ts` (runs in CI).

## 8. Enforcement

- `scripts/check-design-tokens.mjs` fails `pnpm check` on raw hex in
  `apps/extension/**/*.{ts,tsx}` and `apps/web/src/**/*.{astro,ts}` outside
  the allowlist (§1).
- `apps/extension/test/ui/popup-structure.spec.ts` pins the popup structure.
- `apps/extension/test/ui/contrast.spec.ts` pins contrast ratios.
