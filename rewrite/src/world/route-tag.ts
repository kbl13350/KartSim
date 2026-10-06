export type RouteSurfaceKind =
  | "empty" | "rail" | "rain" | "snow" | "rail-rain" | "warpnext"
  | "shake" | "wave" | "zoom" | "lensflare" | "flash" | "unclosed" | "noop";

/** Classifies legacy route surface labels before game effects are dispatched. */
export function routeSurfaceKind(label: string): RouteSurfaceKind {
  if (label === "") return "empty";
  if (label === "rail") return "rail";
  if (label === "norain") return "rain";
  if (label === "nosnow") return "snow";
  if (label === "rail, norain") return "rail-rain";
  if (label === "warpnext") return "warpnext";
  if (/^shake\d+,\d+$/.test(label)) return "shake";
  if (/^wave\d+,\d+,\d+,\d+\s*$/.test(label)) return "wave";
  if (/^zoom(?:Out|In)\d{2}.\d{3}$/.test(label) ||
      label === "zoom20.100" || label === "zoom20.050") return "zoom";
  if (label === "lensflare") return "lensflare";
  if (label === "flash") return "flash";
  if (label === "petSuccess" || label === "flyingPetDisable" ||
      label === "flyingPetEnable" || label.startsWith("event") ||
      label.startsWith("shake") || label.startsWith("wave") ||
      label.includes("rail")) return "unclosed";
  return "noop";
}

/** Removes the route entry/exit direction from an emitted tag. */
export function routeTagFamily(tag: string): string {
  return tag.replace(/:(?:in|out):(?:next|prev)$/, "");
}
