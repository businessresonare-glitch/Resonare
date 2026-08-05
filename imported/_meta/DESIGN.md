---
name: Resonare
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c5d9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e90a2'
  outline-variant: '#434656'
  surface-tint: '#b8c3ff'
  primary: '#b8c3ff'
  on-primary: '#002388'
  primary-container: '#2e5bff'
  on-primary-container: '#efefff'
  inverse-primary: '#124af0'
  secondary: '#c6c6c6'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b5b5b5'
  tertiary: '#c9c6c5'
  on-tertiary: '#313030'
  tertiary-container: '#6e6d6d'
  on-tertiary-container: '#f3f0ef'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#0035be'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c9c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474646'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Syne
    fontSize: 80px
    fontWeight: '800'
    lineHeight: 90px
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Syne
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Syne
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Syne
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  accent-serif:
    fontFamily: Bodoni Moda
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 28px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 32px
  margin-mobile: 24px
  margin-desktop: 80px
---

## Brand & Style
The design system for Resonare embodies a "Professional but Rogue" ethos, blending high-end corporate reliability with an avant-garde editorial edge. It targets premium tech clients and creative disruptors who value precision and personality. 

The visual language is rooted in **Modern Minimalism** with **Glassmorphic** and **Experimental Editorial** infusions. The core motif is the "Echo"—represented through repeating visual elements, rhythmic motion blurs, and layered depth. The aesthetic is intentionally high-impact, utilizing dramatic contrast and expansive negative space to create a sense of focused power and sophisticated rebellion.

## Colors
The palette is dominated by a deep obsidian base to establish a premium, "dark mode" first environment. 

- **Primary (Electric Cobalt):** Used sparingly for high-action touchpoints and "echo" highlights.
- **Secondary (Sharp Silver):** Reserved for high-contrast typography and delicate structural lines.
- **Background Tiers:** The base is `#0A0A0A`. Surface levels use subtle charcoal variations to create depth without losing the obsidian atmosphere.
- **Accents:** Cobalt should be used with motion blurs or glassmorphism to simulate a glowing digital pulse.

## Typography
Typography is the primary driver of the "Rogue" personality. 

- **Headlines (Syne):** Bold, wide, and commanding. Use `display-lg` for hero sections with tight tracking to create a massive, monolithic feel.
- **Body (Hanken Grotesk):** Provides a contemporary, clean, and highly legible counterpoint to the expressive headlines.
- **Accents (Bodoni Moda):** Used for pull quotes, captions, or "editorial interjections" within sections to introduce a high-fashion, sophisticated air.
- **The Echo Effect:** Occasionally layer a low-opacity "outline-only" version of the Syne headline behind the solid text to reinforce the brand motif.

## Layout & Spacing
The layout follows an **Asymmetric Grid** philosophy. Avoid standard 50/50 splits. Instead, use a 12-column grid where content often shifts off-center (e.g., spanning columns 2 through 7, or 8 through 11) to create visual tension and "Rogue" energy.

- **Whitespace:** Use extreme vertical padding (160px+) between major sections to emphasize the premium nature of the content.
- **Echo Repetition:** Break the grid with repeating elements (like a series of vertical lines or offset image stacks) that "trail" off the edge of the screen.
- **Mobile:** Transition to a simplified single-column flow, but maintain the generous vertical rhythm.

## Elevation & Depth
Depth is created through light and transparency rather than traditional shadows.

- **Glassmorphism:** Use background blurs (30px-50px) on navigation bars and cards. Borders on these elements should be 1px solid Silver (#E0E0E0) at 10% opacity.
- **Tonal Layering:** Objects closer to the user are slightly lighter charcoal (#1A1A1A), appearing to emerge from the obsidian base.
- **Cobalt Glow:** Use "Ambient Glows"—large, low-opacity (#2E5BFF at 5%) radial gradients behind key components to simulate a digital aura.
- **Motion Blur:** Interactive elements (like buttons or cards) should utilize a subtle directional blur transition on hover, suggesting an "echo" of movement.

## Shapes
This design system utilizes **Sharp (0px)** roundedness. Every element—from buttons to images to input fields—must have crisp, 90-degree corners. This reinforces the "Professional" and "Technical" aspect of the brand, leaning into a brutalist-adjacent precision.

- **Exceptions:** None. Even "pills" are replaced by sharp rectangular tags.
- **Decorative:** Use ultra-thin 1px lines (Silver) to frame content or create "echo" repeats.

## Components
- **Buttons:** Sharp-edged, solid Cobalt for primary actions. Use a "Ghost Echo" hover state where a secondary sharp frame expands outward from the button. Text is always Hanken Grotesk SemiBold.
- **Input Fields:** Bottom-border only (Silver, 1px). Labels use the `label-caps` style positioned above the line. On focus, the bottom border glows Cobalt.
- **Cards:** Glassmorphic backgrounds with sharp edges. No heavy shadows; use a subtle 1px Silver border.
- **Editorial Chips:** Use Bodoni Moda Italic for chips, encased in a simple sharp 1px Silver box.
- **Progress Indicators:** Linear, ultra-thin cobalt lines that expand across the top of sections or headers.
- **Echo Lists:** List items that, when hovered, reveal a faded, offset duplicate of the text behind the original, creating a literal visual echo.