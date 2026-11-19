import admin from "virtual:admin-css";
import styles from "virtual:styles-css";
import { expect, it } from "vitest";

function withoutMedia(css: string): string {
  let out = "";
  let index = 0;
  while (index < css.length) {
    const at = css.indexOf("@media", index);
    if (at < 0) return out + css.slice(index);
    out += css.slice(index, at);
    const open = css.indexOf("{", at);
    let depth = 0;
    let cursor = open;
    for (; cursor < css.length; cursor += 1) {
      if (css[cursor] === "{") depth += 1;
      if (css[cursor] === "}") {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          break;
        }
      }
    }
    index = cursor;
  }
  return out;
}

function mediaBody(css: string, query: string): string {
  const at = css.indexOf(query);
  if (at < 0) return "";
  const open = css.indexOf("{", at);
  let depth = 0;
  for (let cursor = open; cursor < css.length; cursor += 1) {
    if (css[cursor] === "{") depth += 1;
    if (css[cursor] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, cursor);
    }
  }
  return "";
}

function declaration(block: string, selector: string, property: string): string | undefined {
  let from = 0;
  while (from < block.length) {
    const start = block.indexOf(selector, from);
    if (start < 0) return undefined;
    const open = block.indexOf("{", start);
    const close = block.indexOf("}", open);
    const body = block.slice(open + 1, close);
    const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(body);
    if (match?.[1] !== undefined) return match[1].trim();
    from = close + 1;
  }
  return undefined;
}

function value(css: string, selector: string, property: string, narrow: boolean): string {
  if (narrow) {
    const override = declaration(mediaBody(css, "@media (max-width: 400px)"), selector, property);
    if (override !== undefined) return override;
  }
  return declaration(withoutMedia(css), selector, property) ?? "";
}

function pagePad(narrow: boolean): string {
  return value(styles, "body", "padding", narrow);
}

function shell(narrow: boolean): { margin: string; extra: string } {
  const margin = value(admin, ".admin", "margin", narrow);
  const width = value(admin, ".admin", "width", narrow);
  return {
    margin: margin.replace(/^-/, ""),
    extra: /100%\s*\+\s*([^)]+)/.exec(width)?.[1]?.replace(/\s/g, "") ?? "",
  };
}

it("bleeds the admin shell by the same padding the page uses", () => {
  for (const narrow of [false, true]) {
    const pad = pagePad(narrow);
    const bleed = shell(narrow);
    const doubled = pad === "1rem" ? "2rem" : pad === "1.5rem" ? "3rem" : "";
    expect(pad).not.toBe("");
    expect(bleed.margin).toBe(pad);
    expect(bleed.extra).toBe(doubled);
  }
});
