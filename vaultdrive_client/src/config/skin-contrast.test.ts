// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles/skins.css", import.meta.url), "utf8");
const skins = ["quantix", "light", "dark", "cyberpunk", "elegant", "business"];
function luminance(value: string) {
  const [h, s, l] = value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  const a = s / 100 * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return channel(0) * 0.2126 + channel(8) * 0.7152 + channel(4) * 0.0722;
}
for (const skin of skins) {
  describe(`${skin} text contrast`, () => {
    const block = css.match(new RegExp(`\\[data-theme="${skin}"\\] \\{([^}]+)`))![1];
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
    for (const [fg, bg] of [
      ["foreground", "background"], ["card-foreground", "card"], ["popover-foreground", "popover"],
      ["primary-foreground", "primary"], ["secondary-foreground", "secondary"],
      ["accent-foreground", "accent"], ["destructive-foreground", "destructive"],
      ["destructive", "card"], ["destructive", "muted"],
      ...["background", "card", "muted", "input"].map((surface) => ["muted-foreground", surface]),
    ]) {
      it(`${fg} on ${bg} meets 4.5:1`, () => {
        const a = luminance(tokens[fg]), b = luminance(tokens[bg]);
        expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
