import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  activateSettingsControl, applySettingsGraphicsPreset, applySettingsPreset,
  changeSettingsVolume, closeSettingsCombo, moveSettingsSelection,
  repeatSettingsVolumeStep, resetSettingsSound, selectSettingsSpeed,
  selectSettingsVersion, setSettingsRoomSpeed, stepSettingsVolume,
  stopSettingsVolumePointer, toggleSettingsCombo, toggleSettingsOption,
  type SettingsDraft, type SettingsInteractionDependencies,
  type SettingsInteractionHost, type SpeedChoice,
} from "./settings-interactions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function between(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first, `missing release source: ${start}`);
  return source.slice(first, last);
}
const releasedThumbPosition = new Function(`${between("function tm(n) {", "function cl0(n, e) {")}
  return tm;`)() as (value: number) => number;

test("settings speed, sound, graphics, presets and dialog actions match oy", () => {
  const versions = ["CN", "KR", "empty"];
  const tabs = ["view_graphicsOption@zz", "view_gameOption@zz",
    "view_keyboardMap@zz", "view_macroChatDefine@zz"];
  const speeds: Record<string, SpeedChoice[]> = {
    CN: [{ speed: 7, available: true }, { speed: 4, available: true }],
    KR: [{ speed: 1, available: false }, { speed: 2, available: true }],
    empty: [],
  };
  const deps: SettingsInteractionDependencies = {
    tabs, versions,
    versionStatus: version => ({ available: speeds[version]?.some(choice => choice.available) ?? false }),
    speedChoices: version => speeds[version] ?? [],
    fallbackSpeed: version => speeds[version]?.find(choice => choice.available),
    defaultSound: { bgmEnabled: true, bgmVolume: 1, fxEnabled: true,
      fxVolume: 1, enableRoadSound: false },
    volumeThumb: releasedThumbPosition,
  };
  const Original = new Function("Ie", "Qd", "Ac", "Di", "wa0", "_P", "tm",
    `${between("class oy {", "function tl0(n, e, t) {")}; return oy;`)(
      tabs, versions, deps.versionStatus, deps.speedChoices,
      deps.fallbackSpeed, deps.defaultSound, releasedThumbPosition,
    ) as { prototype: Record<string, (...args: never[]) => unknown> };

  const run = (released: boolean) => {
    const events: unknown[] = [];
    const host = Object.create(Original.prototype) as SettingsInteractionHost & {
      setRoomSpeed(speed: number, version: string): void;
      toggleCombo(name: string): void;
      selectSpeed(choice: SpeedChoice): void;
      closeCombo(): boolean;
      moveSelection(direction: number): void;
      toggle(name: string): void;
      activate(name: string): void;
      repeatTrackVolume(field: string, direction: number, x: number): boolean;
      stopVolumePointer(): void;
    };
    host.options = {
      speedLocked: false,
      onActivate: () => { events.push("activate"); },
      onPreview: draft => { events.push(["preview", { ...draft }]); },
      onConfirm: (draft, speed, version) => {
        events.push(["confirm", { ...draft }, speed, version]);
      },
      onCancel: () => { events.push("cancel"); },
    };
    host.draft = {
      bgmEnabled: false, bgmVolume: 0.4, fxEnabled: false, fxVolume: 0.2,
      enableRoadSound: true, toonLine: true, shadow: false, boostBlur: true,
      mainMenuBgmPath: "unknown", marker: "preserve",
    };
    host.raceSpeed = 7;
    host.raceVersion = "CN";
    host.tab = tabs[0]!;
    host.bgmChoices = Array.from({ length: 11 }, (_, index) => ({ path: `song-${index}` }));
    host.bgmOffset = 0;
    host.render = () => { events.push("render"); };
    host.dismissKeyError = () => { events.push("dismiss-error"); };
    host.resetKeys = () => { events.push("reset-keys"); };
    if (!released) {
      host.setRoomSpeed = (speed, version) => setSettingsRoomSpeed(host, speed, version);
      host.toggleCombo = name => toggleSettingsCombo(host, name);
      host.selectVersion = version => selectSettingsVersion(host, version, deps);
      host.selectSpeed = choice => selectSettingsSpeed(host, choice);
      host.closeCombo = () => closeSettingsCombo(host);
      host.moveSelection = direction => moveSettingsSelection(host, direction, deps);
      host.toggle = name => toggleSettingsOption(host, name);
      host.changeVolume = (field, value) => changeSettingsVolume(host, field, value);
      host.stepVolume = (field, delta) => stepSettingsVolume(host, field, delta);
      host.repeatTrackVolume = (field, direction, x) =>
        repeatSettingsVolumeStep(host, field, direction, x, deps);
      host.stopVolumePointer = () => stopSettingsVolumePointer(host);
      host.activate = name => activateSettingsControl(host, name, deps);
      host.applyPreset = name => applySettingsPreset(host, name);
      host.applyGraphicsPreset = quality => applySettingsGraphicsPreset(host, quality);
      host.resetSound = () => resetSettingsSound(host, deps);
    }
    const states: unknown[] = [];
    const capture = (label: string, result?: unknown) => states.push({
      label, result, draft: { ...host.draft }, raceSpeed: host.raceSpeed,
      raceVersion: host.raceVersion, openCombo: host.openCombo,
      bgmOffset: host.bgmOffset, tab: host.tab,
      volumeRepeat: host.volumeRepeat, volumeDrag: host.volumeDrag,
      events: structuredClone(events),
    });
    capture("initial");
    host.openCombo = "speed";
    host.setRoomSpeed(4, "CN"); capture("room-unlocked");
    host.options.speedLocked = true;
    host.setRoomSpeed(4, "CN"); capture("room-locked");
    host.setRoomSpeed(4, "CN"); capture("room-same");
    host.toggleCombo("speed"); capture("locked-speed-combo");
    host.toggleCombo("bgm"); capture("locked-bgm-combo");
    host.selectVersion("KR");
    host.selectSpeed({ speed: 3, available: true }); capture("locked-choice");
    host.options.speedLocked = false;
    host.toggleCombo("version"); capture("open-version");
    host.selectVersion("KR"); capture("fallback-version-speed");
    host.toggleCombo("speed");
    host.selectSpeed({ speed: 1, available: false }); capture("unavailable-speed");
    host.selectSpeed({ speed: 5, available: true }); capture("available-speed");
    capture("close-none", host.closeCombo());
    host.openCombo = "bgm";
    host.moveSelection(1); capture("bgm-from-unknown");
    host.moveSelection(10); capture("bgm-scroll");
    host.moveSelection(-1); capture("bgm-back");
    host.openCombo = "version";
    host.moveSelection(1); capture("next-version");
    host.openCombo = "speed";
    host.moveSelection(1); capture("next-speed-no-render");
    capture("close-combo", host.closeCombo());
    host.toggle("fxEnabled"); capture("toggle-fx");
    host.changeVolume("bgmVolume", 2); capture("clamp-volume-high");
    host.changeVolume("bgmVolume", -1); capture("clamp-volume-low");
    host.changeVolume("bgmVolume", 0.333333333);
    host.stepVolume("bgmVolume", 500); capture("step-volume");
    capture("repeat-continues", host.repeatTrackVolume("bgmVolume", 1, 0));
    capture("repeat-stops", host.repeatTrackVolume("bgmVolume", -1,
      deps.volumeThumb(host.draft.bgmVolume) + 4));
    host.volumeDrag = { field: "bgmVolume" };
    host.stopVolumePointer(); capture("stop-drag");
    host.activate(tabs[1]!); capture("switch-tab");
    host.activate("defaultSound"); capture("reset-sound");
    host.activate("defaultGraphic"); capture("reset-graphic");
    host.activate("poorM"); capture("poor-graphic");
    host.activate("normM"); capture("normal-graphic");
    host.activate("defaultKeyMap"); capture("reset-keys");
    host.activate("okButton"); capture("dismiss-error");
    host.activate("ok"); capture("confirm");
    host.activate("cancel"); capture("cancel");
    return states;
  };
  assert.deepEqual(run(false), run(true));
});
