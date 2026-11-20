import { expect, it } from "vitest";
import admin from "../src/admin.css?raw";
import styles from "../src/styles.css?raw";

function slice(css: string, narrow: boolean): string {
  const block = /@media \(max-width: 400px\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  if (!narrow) return css.replace(/@media \(max-width: 400px\)\s*\{[\s\S]*?\n\}/, "");
  return block || css;
}

function prop(css: string, selector: string, name: string): string {
  const match = new RegExp(`${selector}\\s*\\{[\\s\\S]*?${name}\\s*:\\s*([^;]+)`).exec(css);
  return match?.[1]?.trim() ?? "";
}

it("bleeds the admin shell by the same padding the page uses", () => {
  for (const narrow of [false, true]) {
    const pad = prop(slice(styles, narrow), "body", "padding");
    const shell = slice(admin, narrow);
    const margin = prop(shell, "\\.admin", "margin").replace(/^-/, "");
    const width = prop(shell, "\\.admin", "width");
    const extra = /100%\s*\+\s*([^)]+)/.exec(width)?.[1]?.replaceAll(" ", "");
    expect(margin).toBe(pad);
    expect(extra).toBe(pad === "1rem" ? "2rem" : "3rem");
  }
});
