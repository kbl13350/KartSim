// Node's test runner does not implement Vite's ?raw imports. Register this
// only from the npm test command; production builds use Vite's own loader.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith("?raw")) {
      const content = readFileSync(new URL(url.slice(0, -4)), "utf8");
      return { format: "module", source: `export default ${JSON.stringify(content)};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
