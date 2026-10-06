import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  angularVelocityInRouteBasis,
  bodyBasisMatrix,
  integrateOrientation,
  matrixFromQuaternion,
  multiplyMatrices,
  quaternionFromMatrix,
  relaxMatrixTowardIdentity,
  setBodyBasis,
  transposeMatrix,
  type OrientedBody,
  type Quaternion,
} from "./orientation-math";
import type { RailMatrix } from "./rail-frame";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const helpers = [
  release.slice(release.indexOf("function bL("), release.indexOf("function Mt(")),
  `const X40=F4(1062380241),Y40=F4(1058398929),$C=F4(1064666457),
   WC=F4(3204993777),HC=F4(1065533027),Z40=F4(1063930709),Q40=F4(1059516753);`,
].join("\n");
const original = new Function("m", `${helpers}\nreturn {bL,hl,xL,ci0,QC,SL,CL,ui0,Gg};`)(Math.fround) as {
  bL(body: OrientedBody): RailMatrix;
  hl(body: OrientedBody, matrix: RailMatrix): void;
  xL(vector: { x: number; y: number; z: number }): { x: number; y: number; z: number };
  ci0(matrix: RailMatrix): RailMatrix;
  QC(left: RailMatrix, right: RailMatrix): RailMatrix;
  SL(matrix: RailMatrix): Quaternion;
  CL(quaternion: Quaternion): RailMatrix;
  ui0(matrix: RailMatrix, fraction: number): RailMatrix;
  Gg(matrix: RailMatrix, velocity: { x: number; y: number; z: number }, seconds: number): RailMatrix;
};

const identity: RailMatrix = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];
const matrixCases: RailMatrix[] = [
  identity,
  [
    { x: 1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: -1 },
  ],
  [
    { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 },
  ],
  [
    { x: -1, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 },
  ],
  original.CL({ w: 0.84, x: 0.26, y: -0.32, z: 0.24 }),
];

test("matrix/quaternion conversion and multiplication preserve float32 release results", () => {
  for (const [index, matrix] of matrixCases.entries()) {
    assert.deepEqual(quaternionFromMatrix(matrix), original.SL(matrix), `quaternion ${index}`);
    assert.deepEqual(matrixFromQuaternion(original.SL(matrix)), original.CL(original.SL(matrix)),
      `round trip ${index}`);
    assert.deepEqual(transposeMatrix(matrix), original.ci0(matrix), `transpose ${index}`);
    assert.deepEqual(multiplyMatrices(matrix, matrixCases[(index + 1) % matrixCases.length]!),
      original.QC(matrix, matrixCases[(index + 1) % matrixCases.length]!), `multiply ${index}`);
  }
});

test("rail relaxation and angular integration match release math", () => {
  const velocity = { x: 0.12, y: -0.23, z: 0.04 };
  for (const [index, matrix] of matrixCases.entries()) {
    for (const fraction of [0, 0.2, 0.5, 0.75, 1]) {
      assert.deepEqual(relaxMatrixTowardIdentity(matrix, fraction), original.ui0(matrix, fraction),
        `relax ${index}/${fraction}`);
    }
    for (const seconds of [0, 0.016, 0.17]) {
      assert.deepEqual(integrateOrientation(matrix, velocity, seconds), original.Gg(matrix, velocity, seconds),
        `integrate ${index}/${seconds}`);
    }
  }
});

test("vehicle and route basis conversions match release", () => {
  const body: OrientedBody = {
    right: { x: 0.82, y: 0.09, z: -0.55 },
    forward: { x: 0.55, y: 0.03, z: 0.83 },
    up: { x: 0.07, y: 0.99, z: 0.05 },
    angularVelocity: { x: 0.12, y: -0.23, z: 0.04 },
  };
  assert.deepEqual(bodyBasisMatrix(body), original.bL(body));
  assert.deepEqual(angularVelocityInRouteBasis(body.angularVelocity), original.xL(body.angularVelocity));
  const expected = structuredClone(body), actual = structuredClone(body);
  original.hl(expected, matrixCases[4]!);
  setBodyBasis(actual, matrixCases[4]!);
  assert.deepEqual(actual, expected);
});
