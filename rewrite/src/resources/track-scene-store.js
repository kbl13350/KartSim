import { Matrix4 } from "three";

/**
 * Flat preorder storage for scene transforms, visibility and culling.
 * Matrix views share their backing Float64Array with the renderer's update path.
 */
export class TrackSceneStore {
  constructor(records) {
    const count = records.length;
    this.count = count;
    this.source = new Array(count);
    this.object = new Array(count);
    this.cullingObject = new Array(count);
    this.bounds = new Array(count);
    this.serializedLocal = new Array(count);
    this.animatedTransform = new Uint8Array(count);
    this.animatedDescendants = new Uint8Array(count);
    this.matrixDirty = new Uint8Array(count).fill(1);
    this.boundsDirty = new Uint8Array(count).fill(1);
    this.enabled = new Uint8Array(count);
    this.cullingTraversalMode = new Int32Array(count);
    this.onCollect = new Array(count);
    this.onVisible = new Array(count);
    this.visibility = new Array(count);
    this.prs = new Array(count);
    this.prsRuntime = new Array(count);
    this.prsFallback = new Array(count);
    this.needsClientWorldInverse = new Uint8Array(count);
    this.runtimeBounds = new Array(count);
    this.ordinaryBoundsStore = new Array(count).fill(undefined);
    this.indexBySource = new Map();

    this.clientWorld = new Float64Array(count * 16);
    this.clientWorldInverse = new Float64Array(count * 16);
    this.clientWorldElementsViews = new Array(count);
    this.clientWorldMatrix = new Array(count);
    this.clientWorldInverseMatrix = new Array(count);
    for (let index = 0; index < count; index++) {
      const record = records[index];
      this.source[index] = record.source;
      this.object[index] = record.object;
      this.cullingObject[index] = record.cullingObject;
      this.bounds[index] = record.bounds;
      this.serializedLocal[index] = record.serializedLocal;
      this.animatedTransform[index] = record.animatedTransform ? 1 : 0;
      this.animatedDescendants[index] = record.animatedDescendants ? 1 : 0;
      this.enabled[index] = record.enabled ? 1 : 0;
      this.cullingTraversalMode[index] = record.cullingTraversalMode;
      this.onCollect[index] = record.onCollect;
      this.onVisible[index] = record.onVisible;
      this.visibility[index] = record.visibility;
      this.prs[index] = record.prs;
      this.prsRuntime[index] = record.prsRuntime;
      this.prsFallback[index] = record.prsFallback;
      this.needsClientWorldInverse[index] = record.needsClientWorldInverse ? 1 : 0;
      this.clientWorld.set(record.initialClientWorld, index * 16);

      const first = index * 16;
      const worldView = this.clientWorld.subarray(first, first + 16);
      const inverseView = this.clientWorldInverse.subarray(first, first + 16);
      this.clientWorldElementsViews[index] = worldView;
      this.clientWorldMatrix[index] = matrixView(worldView);
      this.clientWorldInverseMatrix[index] = matrixView(inverseView);
      this.indexBySource.set(record.source, index);
    }

    const childOffsets = new Int32Array(count + 1);
    const parent = new Int32Array(count).fill(-1);
    const childIndices = [];
    for (let index = 0; index < count; index++) {
      childOffsets[index] = childIndices.length;
      for (const child of records[index].source.children) {
        const childIndex = this.indexBySource.get(child);
        if (childIndex === undefined)
          throw new Error("TrackSceneStore child 缺少 preorder 记录。");
        childIndices.push(childIndex);
        parent[childIndex] = index;
      }
    }
    childOffsets[count] = childIndices.length;
    this.childOffsets = childOffsets;
    this.parent = parent;
    this.childIndices = Int32Array.from(childIndices);
  }

  ordinaryBounds(index) {
    let bounds = this.ordinaryBoundsStore[index];
    if (!bounds) {
      bounds = { kind: "ordinary", min: [0, 0, 0], max: [0, 0, 0] };
      this.ordinaryBoundsStore[index] = bounds;
    }
    return bounds;
  }

  readClientWorld(index, output) {
    output.copy(this.clientWorldMatrix[index]);
  }

  readClientWorldInverse(index, output) {
    output.copy(this.clientWorldInverseMatrix[index]);
  }
}

function matrixView(elements) {
  const matrix = new Matrix4();
  matrix.elements = elements;
  return matrix;
}
