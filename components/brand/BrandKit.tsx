"use client";

import { useState } from "react";
import { PocketMark } from "@/components/brand/pocket-mark";
import { Wordmark } from "@/components/wordmark";
import {
  brand,
  motion,
  palette,
  radii,
  space,
  type as typeScale,
  type Palette,
  type Theme,
} from "@/lib/brand/tokens";

/**
 * The living brand kit.
 *
 * Every sample below is rendered with the *real* `pk-*` classes from
 * `pocket.css` rather than a copy of their rules, so this page cannot drift
 * from the app: if a button changes in the product, it changes here in the
 * same commit. The values are read from `lib/brand/tokens.ts`, which
 * `tokens.test.ts` pins to contrast and shape invariants.
 */

type RoleKey = Exclude<keyof Palette, "lineAlpha">;

const ROLES: { key: RoleKey; varName: string; name: string; use: string }[] = [
  {
    key: "bg",
    varName: "--bg",
    name: "Background",
    use: "The page behind every surface. Never a card.",
  },
  {
    key: "s",
    varName: "--s",
    name: "Surface",
    use: "Cards, sheets, inputs — the default raised material.",
  },
  {
    key: "s2",
    varName: "--s2",
    name: "Quiet surface",
    use: "Flat icon buttons, detail cells, tags.",
  },
  {
    key: "t",
    varName: "--t",
    name: "Text",
    use: "Primary copy. AAA on every surface in both themes.",
  },
  {
    key: "m",
    varName: "--m",
    name: "Muted text",
    use: "Subtitles, timestamps, helper lines — all 12px.",
  },
  {
    key: "p",
    varName: "--p",
    name: "Accent",
    use: "The one brand colour. Selection, focus, the front card.",
  },
  {
    key: "y",
    varName: "--y",
    name: "Highlight",
    use: "The money card that peeks out from behind the purple one.",
  },
  {
    key: "g",
    varName: "--g",
    name: "Success fill",
    use: "Check discs and success circles. Carries white.",
  },
  {
    key: "gInk",
    varName: "--g-ink",
    name: "Success ink",
    use: "Settled amounts, valid-handle hints. Text only.",
  },
  {
    key: "r",
    varName: "--r",
    name: "Danger fill",
    use: "Destructive buttons and invalid borders.",
  },
  {
    key: "rInk",
    varName: "--r-ink",
    name: "Danger ink",
    use: "Every error message. Text only.",
  },
  {
    key: "ph",
    varName: "--ph",
    name: "Placeholder",
    use: "Grab handles, gutters, empty media. Never text.",
  },
  {
    key: "inv",
    varName: "--inv",
    name: "Inverse",
    use: "The primary button and the selected chip.",
  },
  {
    key: "invt",
    varName: "--invt",
    name: "Inverse text",
    use: "Text on the inverse pair.",
  },
  {
    key: "wash",
    varName: "--wash",
    name: "Wash",
    use: "Detail cells inside the yellow and purple cards.",
  },
];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <h2 className="pk-h1 mt-0">{title}</h2>
      {note ? (
        <p className="pk-m max-w-[62ch]" style={{ lineHeight: 1.6 }}>
          {note}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function BrandKit() {
  const [theme, setTheme] = useState<Theme>("light");
  const p = palette[theme];

  return (
    <div
      className="pocket-root"
      data-theme={theme}
      style={{ minHeight: "100svh", background: "var(--bg)" }}
    >
      <div className="mx-auto w-full max-w-[1080px] px-6 pb-20 pt-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="pk-m" style={{ letterSpacing: "0.14em" }}>
              POCKET / BRAND
            </p>
            <h1
              className="mt-2"
              style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.2 }}
            >
              {brand.wordmark.text}
              <span style={{ color: "var(--p)" }}>.</span>
            </h1>
            <p
              className="mt-3 max-w-[52ch] text-[15px]"
              style={{ color: "var(--m)", lineHeight: 1.6 }}
            >
              The product is the brand. Everything here is taken from the app —
              not from the marketing site, which has its own job. New screens
              read these tokens; nothing re-picks a hex.
            </p>
          </div>

          <button
            type="button"
            className="pk-chip"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? "Dark theme" : "Light theme"}
          </button>
        </header>

        <Section
          title="Logo"
          note="Two money cards rising out of a pocket — the same stacked cards the home screen opens on. The mark carries its own ground, so it is always placed as a tile: the tab icon, the installed icon and the badge on the install gate are all this one drawing, scaled."
        >
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
            <div
              className="pk-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <PocketMark size={112} label="Pocket" />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                <PocketMark size={56} />
                <PocketMark size={32} />
                <PocketMark size={20} />
                <PocketMark size={16} />
              </div>
            </div>

            <div
              className="pk-card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <PocketMark size={44} />
                <Wordmark tone="app" className="text-[26px]" />
              </div>
              <p className="pk-m" style={{ lineHeight: 1.6 }}>
                The lockup is the mark plus the lowercase wordmark. The dot stays
                the accent, the mark is never recoloured — including in dark
                theme, where the icon stays the same object on the home screen.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Colour"
          note="Colours are roles, never pigments. A rule that hard-codes a hex is a rule that breaks in the other theme — which is why the same stylesheet carries both."
        >
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            }}
          >
            {ROLES.map((role) => {
              const value = String(p[role.key]);
              return (
                <div key={role.key} className="pk-card" style={{ padding: 0 }}>
                  <div
                    style={{
                      height: 76,
                      background: value,
                      borderRadius: "24px 24px 0 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  />
                  <div style={{ padding: "12px 16px 14px" }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <b style={{ fontSize: 13 }}>{role.name}</b>
                      <code className="pk-m">{role.varName}</code>
                    </div>
                    <code
                      className="pk-m"
                      style={{
                        display: "block",
                        marginTop: 2,
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      {value}
                    </code>
                    <p
                      className="pk-m"
                      style={{ marginTop: 6, lineHeight: 1.5 }}
                    >
                      {role.use}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="pk-card" style={{ padding: 0 }}>
              <div
                style={{
                  height: 76,
                  borderRadius: "24px 24px 0 0",
                  background: "var(--bg)",
                  display: "grid",
                  placeItems: "center",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    width: "84%",
                    borderTop: "1px solid var(--line)",
                  }}
                />
              </div>
              <div style={{ padding: "12px 16px 14px" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <b style={{ fontSize: 13 }}>Hairline</b>
                  <code className="pk-m">--line</code>
                </div>
                <code
                  className="pk-m"
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                  }}
                >
                  t @ {Math.round(p.lineAlpha * 100)}%
                </code>
                <p className="pk-m" style={{ marginTop: 6, lineHeight: 1.5 }}>
                  Derived from the text colour so it inverts with it. Never a
                  hand-picked grey.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Type"
          note="Poppins, three weights. 500 is body, 600 is every heading and amount, 700 is the wordmark. Use the class, not the numbers."
        >
          <div className="pk-card" style={{ padding: "8px 20px" }}>
            {typeScale.scale.map((step) => (
              <div
                key={step.token}
                className="flex items-baseline justify-between gap-6"
                style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}
              >
                <div className="min-w-0">
                  <div
                    className={step.className}
                    style={{
                      margin: 0,
                      lineHeight: step.lineHeight,
                      letterSpacing: step.tracking,
                    }}
                  >
                    Spend your Bitcoin
                  </div>
                  <p className="pk-m" style={{ marginTop: 4 }}>
                    {step.use}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <code className="pk-m">
                    {step.className ? `.${step.className}` : "body"}
                  </code>
                  <p className="pk-m">
                    {step.size}px / {step.weight}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Shape"
          note="Radius rises with elevation: a tag sits closest to the surface, a sheet rises furthest. The primary button is a pill because its radius is half its height."
        >
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            }}
          >
            {(
              [
                ["pill", radii.pill],
                ["input", radii.input],
                ["chip", radii.chip],
                ["card", radii.card],
                ["button", radii.button],
                ["sheet", radii.sheet],
              ] as const
            ).map(([name, value]) => (
              <div key={name} className="pk-card" style={{ padding: 14 }}>
                <div
                  style={{
                    height: 64,
                    borderRadius: value,
                    background: "var(--s2)",
                    border: "1px solid var(--line)",
                  }}
                />
                <div className="mt-3 flex items-baseline justify-between">
                  <b style={{ fontSize: 13 }}>{name}</b>
                  <code className="pk-m">{value}px</code>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Controls"
          note="These are the real classes. Four button weights exist because a screen should have exactly one primary action."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="pk-card">
              <h3 className="pk-h2" style={{ marginBottom: 12 }}>
                Buttons
              </h3>
              <div className="flex flex-col gap-3">
                <button type="button" className="pk-btn">
                  Primary
                </button>
                <button type="button" className="pk-btn pk-btn--alt">
                  Secondary
                </button>
                <button type="button" className="pk-btn pk-btn--pu">
                  Accent
                </button>
                <button type="button" className="pk-btn pk-btn--rd">
                  Destructive
                </button>
                <button type="button" className="pk-btn" disabled>
                  Disabled
                </button>
              </div>
            </div>

            <div className="pk-card">
              <h3 className="pk-h2" style={{ marginBottom: 12 }}>
                Input, chips, tags
              </h3>
              <input className="pk-in" placeholder="A field" readOnly />
              <div className="pk-chips">
                <button type="button" className="pk-chip pk-chip--on">
                  Selected
                </button>
                <button type="button" className="pk-chip">
                  Unselected
                </button>
                <button type="button" className="pk-chip">
                  Another
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="pk-pill">Neutral</span>
                <span className="pk-pill pk-pill--ok">Settled</span>
                <span className="pk-pill pk-pill--warn">Pending</span>
                <span className="pk-pill pk-pill--info">Info</span>
                <span className="pk-pill pk-pill--rd">Failed</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="pk-tg pk-tg--on" aria-hidden />
                <span className="pk-m">On</span>
                <span className="pk-tg" aria-hidden />
                <span className="pk-m">Off</span>
              </div>
            </div>

            <div className="pk-card">
              <h3 className="pk-h2" style={{ marginBottom: 12 }}>
                Money card
              </h3>
              <div
                className="pk-cd pk-cd--front"
                style={{
                  position: "relative",
                  top: 0,
                  height: "auto",
                  minHeight: 132,
                }}
              >
                <p style={{ fontSize: 12, opacity: 0.75 }}>Available</p>
                <p className="pk-big" style={{ marginTop: 2 }}>
                  $2,000 + $300
                </p>
                <div className="pk-det" style={{ opacity: 1, transform: "none" }}>
                  <div>
                    <span>Yours</span>
                    <b>$2,000</b>
                  </div>
                  <div>
                    <span>Borrowed</span>
                    <b>$300</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="pk-card">
              <h3 className="pk-h2" style={{ marginBottom: 12 }}>
                Rows
              </h3>
              <div className="pk-li pk-li--static">
                <span className="pk-ico">↗</span>
                <span className="pk-f">
                  <b>Sent to @alex</b>
                  <span className="pk-m">Today, 14:02</span>
                </span>
                <span className="pk-m">−20.00</span>
              </div>
              <div className="pk-li pk-li--static">
                <span className="pk-ico" style={{ background: "var(--g)" }}>
                  ✓
                </span>
                <span className="pk-f">
                  <b>Received</b>
                  <span className="pk-m">Yesterday</span>
                </span>
                <span className="pk-pos">+120.00</span>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Space, motion, attribution"
          note="Spacing is a 4px grid with a 44px touch target. Motion is feedback, never decoration."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="pk-card">
              <h3 className="pk-h2">Spacing</h3>
              <div className="mt-3 flex flex-col gap-2">
                {Object.entries(space).map(([name, value]) => (
                  <div key={name} className="flex items-center gap-3">
                    <code className="pk-m" style={{ width: 68 }}>
                      {name}
                    </code>
                    <span
                      style={{
                        height: 8,
                        width: value,
                        background: "var(--p)",
                        borderRadius: 4,
                      }}
                    />
                    <code className="pk-m">{value}px</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="pk-card">
              <h3 className="pk-h2">Motion</h3>
              <div className="mt-3 flex flex-col gap-2">
                <p className="pk-m">
                  Press · {motion.press.duration}ms · scale{" "}
                  {motion.press.scale}
                </p>
                <p className="pk-m">
                  State · {motion.state.duration}ms · {motion.state.easing}
                </p>
                <p className="pk-m">
                  Screen spring · stiffness {motion.spring.stiffness}, damping{" "}
                  {motion.spring.damping}
                </p>
                <p className="pk-m" style={{ marginTop: 6, lineHeight: 1.5 }}>
                  Press feedback is felt, not watched. Screen changes are
                  allowed to be seen.
                </p>
              </div>
            </div>

            <div className="pk-card">
              <h3 className="pk-h2">Attribution</h3>
              <div className="mt-3 flex items-center gap-2">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: brand.partners.mezo.accent,
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {brand.partners.mezo.name}
                </span>
              </div>
              <p className="pk-m" style={{ marginTop: 8, lineHeight: 1.5 }}>
                {brand.partners.mezo.use} It is never a background for Pocket
                content and never a button colour.
              </p>
              <p className="pk-m" style={{ marginTop: 10 }}>
                Wordmark: {brand.wordmark.rule}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Rules">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="pk-card">
              <h3 className="pk-h2" style={{ color: "var(--g-ink)" }}>
                Do
              </h3>
              <ul
                className="mt-3 text-[14px]"
                style={{ lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}
              >
                <li>Name the role, not the colour.</li>
                <li>Use one primary action per screen.</li>
                <li>Carry hierarchy with fill, never blur or glass.</li>
                <li>Let the balance be the largest thing on screen.</li>
                <li>Say &ldquo;settled&rdquo; only when the chain says so.</li>
              </ul>
            </div>
            <div className="pk-card">
              <h3 className="pk-h2" style={{ color: "var(--r-ink)" }}>
                Don&rsquo;t
              </h3>
              <ul
                className="mt-3 text-[14px]"
                style={{ lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}
              >
                <li>Hard-code a hex inside a component.</li>
                <li>Use the accent for text on a light surface.</li>
                <li>Use danger for anything that is not already going wrong.</li>
                <li>Stack two surfaces with transparency.</li>
                <li>Introduce a second typeface.</li>
              </ul>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
