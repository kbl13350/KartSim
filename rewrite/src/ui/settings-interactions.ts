export interface SettingsDraft {
  bgmEnabled: boolean;
  bgmVolume: number;
  fxEnabled: boolean;
  fxVolume: number;
  enableRoadSound: boolean;
  toonLine: boolean;
  shadow: boolean;
  boostBlur: boolean;
  mainMenuBgmPath: string;
  [key: string]: unknown;
}

export interface SpeedChoice { speed: number; available: boolean }

export interface SettingsInteractionDependencies {
  tabs: readonly string[];
  versions: readonly string[];
  versionStatus(version: string): { available: boolean };
  speedChoices(version: string): SpeedChoice[];
  fallbackSpeed(version: string): SpeedChoice | undefined;
  defaultSound: Pick<SettingsDraft,
    "bgmEnabled" | "bgmVolume" | "fxEnabled" | "fxVolume" | "enableRoadSound">;
  volumeThumb(value: number): number;
}

export interface SettingsInteractionHost {
  options: {
    speedLocked?: boolean;
    onActivate(): void;
    onPreview(draft: SettingsDraft): void;
    onConfirm(draft: SettingsDraft, speed: number, version: string): void;
    onCancel(): void;
  };
  draft: SettingsDraft;
  raceSpeed: number;
  raceVersion: string;
  openCombo?: string;
  tab: string;
  bgmChoices: Array<{ path: string }>;
  bgmOffset: number;
  volumeRepeat?: ReturnType<typeof setTimeout>;
  volumeDrag?: unknown;
  render(): void;
  dismissKeyError(): void;
  resetKeys(): void;
  applyPreset(name: string): void;
  applyGraphicsPreset(highQuality: boolean): void;
  resetSound(): void;
  selectVersion(version: string): void;
  changeVolume(field: string, value: number): void;
  stepVolume(field: string, delta: number): void;
}

/** A multiplayer room owns the speed controls while this settings view is open. */
export function setSettingsRoomSpeed(host: SettingsInteractionHost,
  speed: number, version: string): void {
  if (!host.options.speedLocked ||
    (host.raceSpeed === speed && host.raceVersion === version)) return;
  host.raceSpeed = speed;
  host.raceVersion = version;
  if (host.openCombo === "speed" || host.openCombo === "version") host.openCombo = undefined;
  host.render();
}

export function toggleSettingsCombo(host: SettingsInteractionHost, name: string): void {
  if (name !== "bgm" && host.options.speedLocked) return;
  host.options.onActivate();
  host.openCombo = host.openCombo === name ? undefined : name;
  host.render();
}

/** Switching a version chooses its first available speed or fallback. */
export function selectSettingsVersion(host: SettingsInteractionHost,
  version: string, deps: SettingsInteractionDependencies): void {
  if (host.options.speedLocked) return;
  host.options.onActivate();
  host.raceVersion = version;
  const first = deps.speedChoices(version)[0];
  if (first?.available) host.raceSpeed = first.speed;
  else {
    const fallback = deps.fallbackSpeed(version);
    if (fallback) host.raceSpeed = fallback.speed;
  }
  host.openCombo = undefined;
  host.render();
}

export function selectSettingsSpeed(host: SettingsInteractionHost, choice: SpeedChoice): void {
  if (host.options.speedLocked || !choice.available) return;
  host.options.onActivate();
  host.raceSpeed = choice.speed;
  host.openCombo = undefined;
  host.render();
}

export function closeSettingsCombo(host: SettingsInteractionHost): boolean {
  if (!host.openCombo) return false;
  host.openCombo = undefined;
  host.render();
  return true;
}

/** Keyboard arrows navigate the open BGM, version or speed list. */
export function moveSettingsSelection(host: SettingsInteractionHost,
  direction: number, deps: SettingsInteractionDependencies): void {
  if (host.openCombo === "bgm") {
    const paths = ["", ...host.bgmChoices.map(choice => choice.path)];
    const previous = paths.indexOf(host.draft.mainMenuBgmPath);
    const index = Math.max(0, Math.min(paths.length - 1, previous + direction));
    host.draft = { ...host.draft, mainMenuBgmPath: paths[index]! };
    if (index < host.bgmOffset) host.bgmOffset = index;
    else if (index >= host.bgmOffset + 8) host.bgmOffset = index - 7;
    host.render();
    return;
  }
  if (host.options.speedLocked) return;
  if (host.openCombo === "version") {
    const versions = deps.versions.filter(version => deps.versionStatus(version).available);
    if (versions.length === 0) return;
    const previous = versions.indexOf(host.raceVersion);
    host.selectVersion(versions[(previous + direction + versions.length) % versions.length]!);
    return;
  }
  const speeds = deps.speedChoices(host.raceVersion).filter(choice => choice.available);
  if (speeds.length === 0) return;
  const previous = speeds.findIndex(choice => choice.speed === host.raceSpeed);
  host.raceSpeed = speeds[(previous + direction + speeds.length) % speeds.length]!.speed;
}

export function toggleSettingsOption(host: SettingsInteractionHost, name: string): void {
  host.draft = { ...host.draft, [name]: !host.draft[name] };
  host.options.onPreview(host.draft);
  host.render();
}

export function changeSettingsVolume(host: SettingsInteractionHost,
  field: string, value: number): void {
  host.draft = { ...host.draft, [field]: Math.fround(Math.max(0, Math.min(1, value))) };
  host.options.onPreview(host.draft);
  host.render();
}

/** The packaged slider stores a 0–4778 value before normalizing it. */
export function stepSettingsVolume(host: SettingsInteractionHost,
  field: string, delta: number): void {
  host.changeVolume(field,
    Math.fround(Math.fround(Math.fround(Number(host.draft[field]) * 4778) + delta) / 4778));
}

export function repeatSettingsVolumeStep(host: SettingsInteractionHost,
  field: string, direction: number, pointerX: number,
  deps: SettingsInteractionDependencies): boolean {
  host.stepVolume(field, direction * 500);
  const thumb = deps.volumeThumb(Number(host.draft[field]));
  return pointerX < thumb || pointerX > thumb + 8;
}

export function stopSettingsVolumePointer(host: SettingsInteractionHost): void {
  clearTimeout(host.volumeRepeat);
  host.volumeRepeat = undefined;
  const drag = host.volumeDrag;
  host.volumeDrag = undefined;
  if (drag) host.render();
}

/** Confirm/cancel bypass redraw; tab and preset buttons redraw the dialog. */
export function activateSettingsControl(host: SettingsInteractionHost,
  name: string, deps: SettingsInteractionDependencies): void {
  if (name === "okButton") {
    host.dismissKeyError();
    return;
  }
  if (name === "ok") {
    host.options.onConfirm(host.draft, host.raceSpeed, host.raceVersion);
    return;
  }
  if (name === "cancel") {
    host.options.onCancel();
    return;
  }
  if (deps.tabs.includes(name)) {
    host.tab = name;
    host.openCombo = undefined;
  } else host.applyPreset(name);
  host.render();
}

export function applySettingsPreset(host: SettingsInteractionHost, name: string): void {
  if (name === "defaultSound") host.resetSound();
  else if (name === "defaultKeyMap") host.resetKeys();
  else if (name === "defaultGraphic") host.draft = { ...host.draft, boostBlur: false };
  else if (name === "poorM" || name === "normM") {
    host.applyGraphicsPreset(name === "normM");
  }
}

export function applySettingsGraphicsPreset(host: SettingsInteractionHost,
  highQuality: boolean): void {
  host.draft = { ...host.draft, toonLine: highQuality,
    shadow: highQuality, boostBlur: false };
}

export function resetSettingsSound(host: SettingsInteractionHost,
  deps: SettingsInteractionDependencies): void {
  const { bgmEnabled, bgmVolume, fxEnabled, fxVolume, enableRoadSound } = deps.defaultSound;
  host.draft = { ...host.draft,
    bgmEnabled, bgmVolume, fxEnabled, fxVolume, enableRoadSound };
  host.options.onPreview(host.draft);
}
