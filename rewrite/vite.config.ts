import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Reuse the downloaded assets during development without copying 3.49 GiB
// into the build output. The source project contains the application code.
const projectDir = fileURLToPath(new URL(".", import.meta.url));
const mirrorDir = fileURLToPath(new URL("../mirror", import.meta.url));

export default defineConfig({
  publicDir: mirrorDir,
  build: { copyPublicDir: false, target: "es2022" },
  server: {
    host: "127.0.0.1",
    port: 8780,
    strictPort: true,
    fs: { allow: [projectDir, mirrorDir] },
  },
});
