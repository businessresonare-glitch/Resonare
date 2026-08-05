/**
 * Generates src/tokens.css from the Stitch design system captured in
 * ../imported/_meta/design_theme.json.
 *
 * The token file is generated rather than hand-written so it stays provably
 * identical to what the MCP import returned. Re-run after any re-import:
 *   node scripts/gen-tokens.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const THEME = resolve(here, '../../imported/_meta/design_theme.json');
const OUT = resolve(here, '../src/tokens.css');

const theme = JSON.parse(readFileSync(THEME, 'utf8'));
const kebab = (s) => s.replace(/_/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const lines = [
  '/*',
  ' * Resonare design system tokens.',
  ' *',
  ' * GENERATED — do not edit by hand. Source of truth is the Stitch import at',
  ' * imported/_meta/design_theme.json; regenerate with scripts/gen-tokens.mjs.',
  ' *',
  ` * Color mode: ${theme.colorMode}. Base spacing unit: ${theme.spacing?.unit}.`,
  ' */',
  '',
  ':root {',
  '  /* Font families */',
  `  --ds-font-display: '${theme.headlineFontFamily}', sans-serif;`,
  `  --ds-font-body: '${theme.bodyFontFamily}', sans-serif;`,
  `  --ds-font-accent: '${theme.labelFontFamily}', serif;`,
  '',
];

const colors = theme.namedColors ?? {};
lines.push(`  /* Palette — ${Object.keys(colors).length} named colors */`);
for (const name of Object.keys(colors).sort()) {
  lines.push(`  --ds-color-${kebab(name)}: ${colors[name]};`);
}

lines.push('', '  /* Brand overrides */');
for (const [key, value] of Object.entries(theme)) {
  if (key.startsWith('override') && typeof value === 'string') {
    lines.push(`  --ds-${kebab(key.replace(/^override/, ''))}: ${value};`);
  }
}

lines.push('', '  /* Type scale */');
for (const [scale, spec] of Object.entries(theme.typography ?? {})) {
  const p = `--ds-text-${scale}`;
  lines.push(`  ${p}-family: '${spec.fontFamily}', sans-serif;`);
  lines.push(`  ${p}-size: ${spec.fontSize};`);
  lines.push(`  ${p}-weight: ${spec.fontWeight};`);
  lines.push(`  ${p}-leading: ${spec.lineHeight};`);
  if (spec.letterSpacing) lines.push(`  ${p}-tracking: ${spec.letterSpacing};`);
}

lines.push('', '  /* Spacing */');
for (const [name, value] of Object.entries(theme.spacing ?? {})) {
  lines.push(`  --ds-space-${kebab(name)}: ${value};`);
}
const unit = Number.parseInt(theme.spacing?.unit ?? '8', 10);
for (const step of [1, 2, 3, 4, 6, 8, 10, 12, 16, 20]) {
  lines.push(`  --ds-space-${step}: ${unit * step}px;`);
}

lines.push(
  '',
  '  /* Shape — the design system specifies sharp corners with no exceptions. */',
  '  --ds-radius: 0px;',
  '}',
  '',
);

writeFileSync(OUT, lines.join('\n'));
console.log(
  `tokens.css: ${Object.keys(colors).length} colors, ` +
    `${Object.keys(theme.typography ?? {}).length} type scales, ` +
    `${lines.length} lines`,
);
