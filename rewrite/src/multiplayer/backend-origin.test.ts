import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { multiplayerBackendOrigin, multiplayerEndpoint,
  type MultiplayerOriginConfig } from "./backend-origin";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function ay(");
const end = release.indexOf("\nconst cy =", start);
assert.ok(start >= 0 && end > start);
const originalFunctions = release.slice(start, end);

type ConfigCase = {
  page: string;
  config?: MultiplayerOriginConfig;
  bundled?: string;
};

function outcome(run: () => string): { value?: string; error?: string } {
  try { return { value: run() }; }
  catch (error) { return { error: `${(error as Error).name}:${(error as Error).message}` }; }
}

function observe(rewritten: boolean, setup: ConfigCase, endpoint?: string) {
  const Original = new Function("window", "ml0",
    `${originalFunctions}\nreturn { ay, Ko };`)(
      setup.config === undefined ? undefined :
        { __KART_MULTIPLAYER_CONFIG__: setup.config },
      { VITE_MULTIPLAYER_BACKEND_ORIGIN: setup.bundled },
    ) as { ay(pageUrl: string): string;
      Ko(endpoint: string, pageUrl: string): string };
  return outcome(() => endpoint === undefined
    ? rewritten
      ? multiplayerBackendOrigin(setup.page, setup.config, setup.bundled)
      : Original.ay(setup.page)
    : rewritten
      ? multiplayerEndpoint(endpoint, setup.page, setup.config, setup.bundled)
      : Original.Ko(endpoint, setup.page));
}

test("multiplayer origin allowlist, backend fallback and URL validation match release", () => {
  const page = "https://game.example.com/room";
  const good = "https://api.example.com";
  const cases: ConfigCase[] = [
    { page, config: { backendOrigin: good } },
    { page, config: { backendOrigin: ` ${good} ` } },
    { page, config: { frontendOrigin: "https://game.example.com",
      backendOrigin: good } },
    { page, config: { frontendOrigins: ["https://game.example.com"],
      backendOrigin: good } },
    { page, config: { frontendOrigins: ["https://other.example.com"],
      backendOrigin: good } },
    { page, config: { frontendOrigins: [], backendOrigin: good } },
    { page, config: { frontendOrigins: null, backendOrigin: good } },
    { page, config: { frontendOrigins: "https://game.example.com",
      backendOrigin: good } },
    { page, config: { frontendOrigins: ["https://*.example.com"],
      backendOrigin: good } },
    { page, config: { frontendOrigins: ["https://game.example.com/"],
      backendOrigin: good } },
    { page, config: { frontendOrigins: ["ftp://game.example.com"],
      backendOrigin: good } },
    { page, config: { frontendOrigins: [42], backendOrigin: good } },
    { page, config: { backendOrigin: "" }, bundled: good },
    { page, bundled: good },
    { page, config: {} },
    { page, config: { backendOrigin: "http://api.example.com" } },
    { page: "http://game.example.com", config: {
      backendOrigin: "http://api.example.com" } },
    { page, config: { backendOrigin: "https://api.example.com/" } },
    { page, config: { backendOrigin: "https://api.example.com/path" } },
    { page, config: { backendOrigin: "https://u:p@api.example.com" } },
    { page, config: { backendOrigin: "https://api.example.com/?q=1" } },
    { page, config: { backendOrigin: "https://api.example.com/#x" } },
    { page, config: { backendOrigin: "ftp://api.example.com" } },
    { page: "invalid-page", config: { backendOrigin: good } },
  ];
  for (const setup of cases) {
    assert.deepEqual(observe(true, setup), observe(false, setup),
      JSON.stringify(setup));
  }
});

test("multiplayer endpoint path validation and origin composition match release", () => {
  const setup = { page: "https://game.example.com/room",
    config: { backendOrigin: "https://api.example.com" } };
  for (const endpoint of ["auth/login", "rooms", "v2/room-1", "AUTH/logout",
    "", "/rooms", "../room", "a..b", "room?x", "room#x",
    "room*", "room space", "room\\enter"]) {
    assert.deepEqual(observe(true, setup, endpoint),
      observe(false, setup, endpoint), endpoint);
  }
});
