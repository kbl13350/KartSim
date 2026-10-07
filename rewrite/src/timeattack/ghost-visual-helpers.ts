export interface GhostVehicleIdentity {
  kartId: number;
  engineGrade: number;
}

/** Choose the Ghost's visible booster trail while preserving classic kart rules. */
export function ghostTrailState(
  status: number, previous: number, vehicle: GhostVehicleIdentity,
  boosterTrail: (booster: number) => number,
): number {
  const booster = status & 7;
  let trail = booster === 0 ? previous : boosterTrail(booster);
  if (vehicle.kartId !== 0 && vehicle.engineGrade <= 6)
    return booster === 0 ? 0 : trail;
  const firstDualFlag = (status & 4096) !== 0;
  const secondDualFlag = (status & 8192) !== 0;
  if (firstDualFlag !== secondDualFlag) {
    if (secondDualFlag) trail = 10;
  } else if (booster === 0 && !firstDualFlag &&
      ((status >>> 3) & 15) + 3 !== 14) {
    trail = 0;
  }
  return trail;
}

export interface GhostRecordWithStatus {
  stamps: Array<{ status: number }>;
}

export interface GhostEffectNameDependencies {
  boosterState(status: number): number;
  boosterEffect(booster: number): string | undefined;
  secondaryEffect(booster: number): string | undefined;
  secondaryState(status: number): number;
}

/** Identify every effect required before loading a Ghost recording. */
export function ghostEffectNames(record: GhostRecordWithStatus,
  ops: GhostEffectNameDependencies): Set<string> {
  const names = new Set<string>();
  for (const stamp of record.stamps) {
    const status = stamp.status;
    const booster = ops.boosterState(status);
    const primary = ops.boosterEffect(booster);
    if (primary) names.add(primary);
    const secondary = ops.secondaryEffect(booster);
    if (secondary) names.add(secondary);
    if ((status & 32768) !== 0) names.add("exceedWave");
    const animation = ops.secondaryState(status);
    if (animation === 1 && (booster === 3 || booster === 4 || booster === 5)) {
      names.add("boosterDualIdle");
      names.add("boosterDualIdleTeam");
    }
    if (animation === 3 && booster === 10) {
      names.add("boosterDual");
      names.add("boosterDualTeam");
      names.add("baseBoosterWave");
    }
  }
  return names;
}

export interface GhostToonMaterial {
  uniforms: {
    baseMap: { value: unknown };
    toonEnv: { value: unknown };
  };
  clone(): GhostToonMaterial;
}

export interface GhostMesh {
  material: unknown | unknown[];
  onBeforeRender: (...args: unknown[]) => void;
}

export interface GhostSceneRoot {
  traverse(callback: (object: unknown) => void): void;
}

export interface GhostToonDependencies {
  isMesh(object: unknown): object is GhostMesh;
  isToon(material: unknown): material is GhostToonMaterial;
  prepareClone(clone: GhostToonMaterial): void;
  refreshMesh(mesh: GhostMesh): void;
  copyToon(source: GhostToonMaterial, clone: GhostToonMaterial): void;
}

/** Clone Ghost toon materials while keeping their texture owners shared. */
export function cloneGhostToonMaterials(
  root: GhostSceneRoot,
  pairs: Array<{ source: GhostToonMaterial; clone: GhostToonMaterial }> | undefined,
  ops: GhostToonDependencies,
): number {
  let changedMeshes = 0;
  root.traverse(object => {
    if (!ops.isMesh(object)) return;
    const mesh = object;
    const originalMaterial = mesh.material;
    const sources = Array.isArray(originalMaterial)
      ? originalMaterial : [originalMaterial];
    const clones = sources.map(material => {
      if (!ops.isToon(material)) return material;
      const clone = material.clone();
      clone.uniforms.baseMap.value = material.uniforms.baseMap.value;
      clone.uniforms.toonEnv.value = material.uniforms.toonEnv.value;
      ops.prepareClone(clone);
      return clone;
    });
    if (!clones.some((clone, index) => clone !== sources[index])) return;
    mesh.material = Array.isArray(originalMaterial) ? clones : clones[0];
    ops.refreshMesh(mesh);
    if (pairs) {
      clones.forEach((clone, index) => {
        const source = sources[index];
        if (clone !== source && ops.isToon(source) && ops.isToon(clone))
          pairs.push({ source, clone });
      });
    } else {
      const previous = mesh.onBeforeRender;
      mesh.onBeforeRender = function (renderer, scene, camera,
        geometry, material, group) {
        previous.call(this, renderer, scene, camera, geometry, material, group);
        clones.forEach((clone, index) => {
          const source = sources[index];
          if (clone !== source && ops.isToon(source) && ops.isToon(clone))
            ops.copyToon(source, clone);
        });
      };
    }
    changedMeshes += 1;
  });
  return changedMeshes;
}
