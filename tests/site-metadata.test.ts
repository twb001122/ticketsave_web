import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("site metadata", () => {
  it("uses the comedy crossroads title and search metadata", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

    expect(html).toContain("<title>马达的喜剧路口</title>");
    expect(html).toContain(
      '<meta name="description" content="这里会记录一下脱口秀演员马达的演出、他的日记、他的观众、他的朋友、他的喜剧、他的夏天和他的东四。" />'
    );
    expect(html).toContain(
      '<meta name="keywords" content="马达, 脱口秀演员马达, 马达的喜剧路口, 脱口秀, 喜剧, 演出日历, 票根, 喜剧日记, 留言板, 东四, 夏天" />'
    );
  });
});
