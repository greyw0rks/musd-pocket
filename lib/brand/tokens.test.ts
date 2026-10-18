/**
 * The brand kit's own tests.
 *
 * A design system that is only a list of hex codes is a mood board. These
 * assertions are what make it a system: every theme defines every role, and
 * every pair the product actually renders together clears the contrast it is
 * used at. If a value is changed to something prettier and less legible, this
 * fails before a screenshot does.
 *
 * Run with `npm run test:brand`.
 */

import assert from "node:assert/strict";
import {
  brand,
  motion,
  palette,
  radii,
  space,
  type,
  type Palette,
  type Theme,
} from "./tokens.ts";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};

/* ------------------------------------------------------------ contrast math */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  assert.equal(h.length, 6, `${hex} is not a six-digit hex colour`);
  const r = channel(parseInt(h.slice(0, 2), 16));
  const g = channel(parseInt(h.slice(2, 4), 16));
  const b = channel(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
const themes: Theme[] = ["light", "dark"];
const ROLE_KEYS = Object.keys(palette.light) as (keyof Palette)[];

/* ------------------------------------------------------------------ palette */

check("every theme defines every role", () => {
  for (const theme of themes) {
    for (const key of ROLE_KEYS) {
      const value = palette[theme][key];
      assert.ok(
        value !== undefined && value !== null && value !== "",
        `${theme}.${key} is missing`,
      );
    }
  }
});

check("light and dark define exactly the same roles", () => {
  assert.deepEqual(Object.keys(palette.dark).sort(), Object.keys(palette.light).sort());
});

check("every colour role is a colour, not a leftover name", () => {
  for (const theme of themes) {
    for (const key of ROLE_KEYS) {
      if (key === "lineAlpha") continue;
      assert.match(
        String(palette[theme][key]),
        /^(#[0-9a-f]{6}|rgb\()/,
        `${theme}.${key} is not a colour literal`,
      );
    }
  }
});

/*
  Body text on the page and on a card. 7:1 is AAA for normal text; the app's
  primary copy is 15px at weight 500, so it is not "large text" and does not get
  the 3:1 allowance.
*/
for (const theme of themes) {
  check(`${theme}: text on background is AAA (>= 7:1)`, () => {
    const ratio = contrast(palette[theme].t, palette[theme].bg);
    assert.ok(ratio >= 7, `got ${ratio.toFixed(2)}:1`);
  });

  check(`${theme}: text on a surface is AAA (>= 7:1)`, () => {
    const ratio = contrast(palette[theme].t, palette[theme].s);
    assert.ok(ratio >= 7, `got ${ratio.toFixed(2)}:1`);
  });

  /*
    Muted is 12px. It is the single most common text in the app (every subtitle,
    every timestamp, every helper line) and it is exactly the size where a
    pretty grey stops being readable in daylight.
  */
  check(`${theme}: muted text on a surface clears AA (>= 4.5:1)`, () => {
    const ratio = contrast(palette[theme].m, palette[theme].s);
    assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
  });

  check(`${theme}: success ink on a surface clears AA (>= 4.5:1)`, () => {
    const ratio = contrast(palette[theme].gInk, palette[theme].s);
    assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
  });

  check(`${theme}: danger ink on a surface clears AA (>= 4.5:1)`, () => {
    const ratio = contrast(palette[theme].rInk, palette[theme].s);
    assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
  });

  check(`${theme}: the inverse pair is AAA (>= 7:1)`, () => {
    const ratio = contrast(palette[theme].invt, palette[theme].inv);
    assert.ok(ratio >= 7, `got ${ratio.toFixed(2)}:1`);
  });

  check(`${theme}: danger ink on the page background clears AA (>= 4.5:1)`, () => {
    const ratio = contrast(palette[theme].rInk, palette[theme].bg);
    assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}:1`);
  });
}

/*
  Labels that sit *on* a coloured fill. These are fills, not text backgrounds on
  a page, so the fill is fixed and the label has to win.
*/
check("white label on the purple fill clears AA (>= 4.5:1)", () => {
  for (const theme of themes) {
    const ratio = contrast(WHITE, palette[theme].p);
    assert.ok(ratio >= 4.5, `${theme} got ${ratio.toFixed(2)}:1`);
  }
});

check("white label on the danger fill clears AA (>= 4.5:1)", () => {
  for (const theme of themes) {
    const ratio = contrast(WHITE, palette[theme].r);
    assert.ok(ratio >= 4.5, `${theme} got ${ratio.toFixed(2)}:1`);
  }
});

check("the success fill is a distinguishable graphical object (>= 3:1 on a surface)", () => {
  // A check disc is a graphical object, not a text run: WCAG's bar for it is
  // 3:1. It carries a white glyph, so the fill cannot also be the ink colour.
  for (const theme of themes) {
    const ratio = contrast(palette[theme].g, palette[theme].s);
    assert.ok(ratio >= 3, `${theme} got ${ratio.toFixed(2)}:1`);
  }
});

check("the hairline is visible on both surfaces in both themes", () => {
  // Derived as `color-mix(t lineAlpha, transparent)`; the alpha only has to be
  // non-zero and small enough not to read as a rule. This guards the constant.
  for (const theme of themes) {
    const alpha = palette[theme].lineAlpha;
    assert.ok(alpha > 0 && alpha < 0.3, `${theme} lineAlpha is ${alpha}`);
  }
});

/* --------------------------------------------------------------------- type */

check("the type scale descends without duplicates", () => {
  const sizes = type.scale.map((step) => step.size);
  assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a));
  assert.equal(new Set(sizes).size, sizes.length, "two steps share a size");
});

check("every type step names a real weight", () => {
  const allowed = new Set(Object.values(type.weights));
  for (const step of type.scale) {
    assert.ok(allowed.has(step.weight), `${step.token} uses weight ${step.weight}`);
  }
});

check("the font stack leads with Poppins", () => {
  assert.equal(type.stack.split(",")[0].trim(), type.family);
});

/* -------------------------------------------------------------------- shape */

check("radii rise with elevation", () => {
  assert.ok(radii.pill < radii.input);
  assert.ok(radii.input < radii.chip);
  assert.ok(radii.chip < radii.card);
  assert.ok(radii.card < radii.button);
  assert.ok(radii.button < radii.sheet);
  assert.ok(radii.sheet < radii.shell);
});

check("the primary button is a pill: radius is half its height", () => {
  assert.equal(space.button / 2, radii.button);
});

check("the spacing scale is built on a 4px grid", () => {
  /*
    Only the gaps. `touch` and `button` live in the same object because they
    are the same kind of number — a height a layout reserves — but they are not
    rhythm: `button` is 54px because that is the control the app actually
    draws, and the pill's radius is half of it. Rounding it to the grid would
    mean changing the product to suit the test.
  */
  const gaps = ["xs", "sm", "md", "lg", "xl", "xxl", "section"] as const;
  for (const name of gaps) {
    assert.equal(space[name] % 4, 0, `space.${name} is ${space[name]}`);
  }
});

check("control heights stay even, so a half-height radius is whole", () => {
  assert.equal(space.touch % 2, 0);
  assert.equal(space.button % 2, 0);
});

check("the smallest touch target is the 44px control height", () => {
  assert.ok(space.touch >= 44);
});

/* ------------------------------------------------------------------- motion */

check("motion is quick enough to read as feedback", () => {
  assert.ok(motion.press.duration <= 250);
  assert.ok(motion.state.duration <= 400);
  assert.ok(motion.press.scale < 1 && motion.press.scale > 0.9);
  for (const value of Object.values(motion.spring)) {
    assert.ok(Number.isFinite(value) && value > 0);
  }
});

/* ---------------------------------------------------------------- cohesion */

check("the bundle exposes every part under one name", () => {
  assert.equal(brand.name, "Pocket");
  assert.equal(brand.palette, palette);
  assert.equal(brand.type, type);
  assert.equal(brand.radii, radii);
  assert.equal(brand.space, space);
  assert.equal(brand.motion, motion);
});

check("the wordmark is lowercase with one dot", () => {
  assert.equal(brand.wordmark.text, brand.wordmark.text.toLowerCase());
  assert.ok(brand.wordmark.dot);
});

check("the partner accent is not part of the product palette", () => {
  const productColours = new Set(
    themes.flatMap((theme) => ROLE_KEYS.map((key) => String(palette[theme][key]))),
  );
  assert.ok(!productColours.has(brand.partners.mezo.accent));
});

console.log(`\n${passed} brand checks passed`);
