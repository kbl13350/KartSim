import assert from 'node:assert/strict';
import test from 'node:test';
import * as three from 'three';
import * as release from '../src/vendor/legacy-three.ts';

test('the recovered renderer uses the same public Three.js revision', () => {
  assert.equal(three.REVISION, '178');
  assert.equal(release.H, three.Vector3);
  assert.equal(release.v2, three.Matrix4);
  assert.equal(release.I4, three.WebGLRenderer);
  assert.equal(release.$1, three.ShaderMaterial);
  assert.equal(release.z2, three.ShaderChunk);
  const point = new release.H(1, 2, 3).applyMatrix4(
    new release.v2().makeTranslation(4, -2, 5));
  assert.deepEqual(point.toArray(), [5, 0, 8]);
});

test('result highlights keep the release team and ranked rules', () => {
  const roster = [
    { playerId: 'a', team: 1 },
    { playerId: 'b', team: 2 },
    { playerId: 'c', team: 1 },
  ];
  const results = [
    { playerId: 'a', rank: 1, elapsedMs: 1000 },
    { playerId: 'b', rank: 2, elapsedMs: null },
    { playerId: 'c', rank: 4, elapsedMs: 3000 },
  ];
  assert.deepEqual(release.rG('individual', roster, results, 1), ['a']);
  assert.deepEqual(release.rG('team', roster, results, 1), ['a', 'c']);
});
