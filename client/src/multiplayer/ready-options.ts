/** Align Ready settings with the released multiplayer mode rules. */

export function multiplayerReadyOptions<T extends Record<string, unknown>>(
  options: T, speed: (options: T) => number): T & {
    speed: number; version: string; settingSpeed: number;
  } {
  const selectedSpeed = speed(options);
  const permittedSpeed = (options.version ?? "国服") === "国服" &&
    selectedSpeed === 4 ? 4 : 7;
  return { ...options, speed: permittedSpeed, version: "国服",
    settingSpeed: 7 };
}
