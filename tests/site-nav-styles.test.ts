import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("site nav styles", () => {
  it("keeps the nav top offset aligned between the home page and content pages", async () => {
    const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(styles).toContain(".home-page {");
    expect(styles).toContain("width: 100%;");
    expect(styles).toContain("overflow: hidden;");
    expect(styles).toContain("padding: 18px 0 0;");
    expect(styles).toContain(".home-nav {\n  position: relative;");
    expect(styles).toContain("padding: 18px 0 8px;");
    expect(styles).toContain(".page:has(> .home-nav) {\n  padding-top: 18px;\n}");
    expect(styles).toContain(".page > .home-nav {\n  width: 100%;\n  margin-bottom: 36px;\n  padding: 18px 0 8px;\n}");
  });

  it("adds the soft animated page background and hero title treatment", async () => {
    const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(styles).toContain(".home-page::before");
    expect(styles).toContain(".home-page::after");
    expect(styles).toContain("animation: homeAtmosphere");
    expect(styles).toContain("@keyframes homeAtmosphere");
    expect(styles).toContain(".home-title-accent");
    expect(styles).toContain("background: linear-gradient(90deg, #ee8a38 0%, #d94732 100%);");
    expect(styles).toContain("-webkit-background-clip: text;");
    expect(styles).toContain(".home-hero-title {");
    expect(styles).toContain("margin-top: 18px;");
    expect(styles).toContain(".home-hero-copy {");
    expect(styles).toContain("margin-top: 26px;");
    expect(styles).toContain(".home-hero-entry > strong");
    expect(styles).toContain("margin-top: -8px;");
  });
});
