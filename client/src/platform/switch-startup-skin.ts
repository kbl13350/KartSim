import { installStartupLoadingSkin } from "../ui/startup-loading-skin";

// main.ts installs the loading skin before the release modules; main-switch.ts imports this in its place.
installStartupLoadingSkin();
