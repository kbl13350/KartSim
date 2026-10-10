import {
  ConstantAlphaFactor, CustomBlending, OneMinusConstantAlphaFactor, type Material, type Object3D,
} from "three";
import type { ItemKartPresentationState } from "./item-race-presenter";

/**
 * Applies the item presenter's look of a racer's kart (`kartPresentation`)
 * to its scene objects every frame: invisible (tigerGhost) karts are hidden
 * from other teams together with their trails and drawn translucent for
 * their own racer and teammates; a balloon that took a missile is hidden
 * while it pops. The racer view keeps every other visibility decision (reset
 * blinking, warp); this only narrows it.
 *
 * The kart and character materials are the toon shader, which has no
 * opacity input, and copies of the same kart may share them. Translucency is
 * therefore applied per mesh around its own draw (`onBeforeRender` sets a
 * constant-alpha blend on the material, `onAfterRender` restores it), and
 * the meshes draw after the rest of the scene (`renderOrder`) so what is
 * behind them is already in the frame.
 */

export interface ItemKartPresentationTarget {
  /** The racer view root (kart, character, accessories, balloon). */
  root: Object3D;
  /** Objects that follow the kart outside the root (the booster trails). */
  extras?: ReadonlyArray<{ visible: boolean } | undefined>;
  /** The balloon accessory (vehicle decoration). */
  balloon?: { visible: boolean };
}

/** Draw order of a translucent kart: after every ordinary object of the track. */
const GHOST_RENDER_ORDER = 1_000_000;

interface GhostMesh {
  readonly mesh: Object3D;
  readonly renderOrder: number;
  readonly onBeforeRender: Object3D["onBeforeRender"];
  readonly onAfterRender: Object3D["onAfterRender"];
}

interface Ghost { opacity: number; meshes: GhostMesh[] }

const ghosts = new WeakMap<Object3D, Ghost>();

interface SavedBlend {
  blending: Material["blending"]; blendSrc: Material["blendSrc"]; blendDst: Material["blendDst"];
  blendAlpha: number; transparent: boolean;
}

function materials(material: unknown): Material[] {
  return Array.isArray(material) ? material as Material[] : material ? [material as Material] : [];
}

function makeGhost(root: Object3D, opacity: number): Ghost {
  const ghost: Ghost = { opacity, meshes: [] };
  const saved = new Map<Material, SavedBlend>();
  root.traverse(object => {
    const drawable = object as Object3D & { isMesh?: boolean; isSprite?: boolean; material?: unknown };
    if (!drawable.isMesh && !drawable.isSprite) return;
    ghost.meshes.push({ mesh: object, renderOrder: object.renderOrder,
      onBeforeRender: object.onBeforeRender, onAfterRender: object.onAfterRender });
    const own = { before: object.onBeforeRender, after: object.onAfterRender };
    object.renderOrder = GHOST_RENDER_ORDER;
    object.onBeforeRender = function (...args) {
      own.before.apply(this, args);
      for (const material of materials(drawable.material)) {
        // Materials that already blend keep their own blend (glass, glows).
        if (material.transparent || saved.has(material)) continue;
        saved.set(material, { blending: material.blending, blendSrc: material.blendSrc,
          blendDst: material.blendDst, blendAlpha: material.blendAlpha, transparent: material.transparent });
        material.blending = CustomBlending;
        material.blendSrc = ConstantAlphaFactor;
        material.blendDst = OneMinusConstantAlphaFactor;
        material.blendAlpha = ghost.opacity;
      }
    };
    object.onAfterRender = function (...args) {
      for (const material of materials(drawable.material)) {
        const blend = saved.get(material);
        if (!blend) continue;
        material.blending = blend.blending;
        material.blendSrc = blend.blendSrc;
        material.blendDst = blend.blendDst;
        material.blendAlpha = blend.blendAlpha;
        material.transparent = blend.transparent;
        saved.delete(material);
      }
      own.after.apply(this, args);
    };
  });
  return ghost;
}

function clearGhost(root: Object3D): void {
  const ghost = ghosts.get(root);
  if (!ghost) return;
  for (const entry of ghost.meshes) {
    entry.mesh.renderOrder = entry.renderOrder;
    entry.mesh.onBeforeRender = entry.onBeforeRender;
    entry.mesh.onAfterRender = entry.onAfterRender;
  }
  ghosts.delete(root);
}

/** Objects this module hid, shown again once the look ends. */
const hidden = new WeakSet<{ visible: boolean }>();

function hide(object: { visible: boolean } | undefined, hide: boolean): void {
  if (!object) return;
  if (hide) {
    if (object.visible) hidden.add(object);
    object.visible = false;
  } else if (hidden.has(object)) {
    hidden.delete(object);
    object.visible = true;
  }
}

/** Narrow a racer's visibility by its item look this frame (undefined: as usual). */
export function applyItemKartPresentation(target: ItemKartPresentationTarget,
  state: ItemKartPresentationState | undefined): void {
  const opacity = state?.opacity ?? 1;
  // The root's visibility is decided again every frame by the racer view.
  if (opacity <= 0) target.root.visible = false;
  for (const extra of target.extras ?? []) hide(extra, opacity <= 0);
  hide(target.balloon, state !== undefined && !state.balloonVisible);
  if (opacity > 0 && opacity < 1) {
    const ghost = ghosts.get(target.root);
    if (ghost) ghost.opacity = opacity;
    else ghosts.set(target.root, makeGhost(target.root, opacity));
  } else clearGhost(target.root);
}
