import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "css-url-in-tests",
      enforce: "pre",
      load(id) {
        const [filename, query] = id.split("?");
        if (query === "url" && filename?.endsWith(".css")) {
          return `export default ${JSON.stringify(filename)}`;
        }
        return undefined;
      },
    },
  ],
  test: {
    environment: "node",
    include: ["test/**/*.test.tsx"],
  },
});
