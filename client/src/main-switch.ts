// The Nintendo Switch package's entry (vite build --mode switch, SWITCH.md).
// Static imports run in order: the platform layer has filled Brewser's gaps
// and loaded the server address before the release modules evaluate.
import "./platform/switch-runtime";
import "./platform/switch-startup-skin";
// The TrackWorld module installs all handwritten instance methods when loaded.
import "./generated/world.js";
import "./generated/app.js";

export {};
