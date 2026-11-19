import { defineConfig } from "vitest/config";

const workersStub = new URL("./test/cloudflare-workers-stub.ts", import.meta.url).pathname;

function readCss(filename: string): string {
  const scope: object = globalThis;
  if (!("process" in scope)) return "";
  const proc = scope.process;
  if (typeof proc !== "object" || proc === null || !("getBuiltinModule" in proc)) return "";
  const getBuiltin = proc.getBuiltinModule;
  if (typeof getBuiltin !== "function") return "";
  const reader: unknown = getBuiltin("node:fs");
  if (typeof reader !== "object" || reader === null || !("readFileSync" in reader)) return "";
  const read = reader.readFileSync;
  if (typeof read !== "function") return "";
  const text: unknown = read(filename, "utf8");
  return typeof text === "string" ? text : "";
}

export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": workersStub,
    },
  },
  plugins: [
    {
      name: "css-url-in-tests",
      enforce: "pre",
      resolveId(id) {
        if (id === "virtual:styles-css") return "\0virtual:styles-css";
        if (id === "virtual:admin-css") return "\0virtual:admin-css";
        return undefined;
      },
      load(id) {
        if (id === "\0virtual:styles-css") {
          const file = new URL("./src/styles.css", import.meta.url);
          return `export default ${JSON.stringify(readCss(file.pathname))}`;
        }
        if (id === "\0virtual:admin-css") {
          const file = new URL("./src/admin.css", import.meta.url);
          return `export default ${JSON.stringify(readCss(file.pathname))}`;
        }
        const [filename, query] = id.split("?");
        if (!filename?.includes(".css")) return undefined;
        if (query?.includes("url")) return `export default ${JSON.stringify(filename)}`;
        return "export default {}";
      },
    },
  ],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
