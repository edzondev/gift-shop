import { defineConfig } from "vitest/config";

const workersStub = new URL("./test/cloudflare-workers-stub.ts", import.meta.url).pathname;

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
      load(id) {
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
