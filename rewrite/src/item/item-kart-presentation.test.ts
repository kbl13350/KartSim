import assert from "node:assert/strict";
import test from "node:test";
import {
  BoxGeometry, ConstantAlphaFactor, CustomBlending, Group, Mesh, MeshBasicMaterial, NormalBlending,
  OneMinusConstantAlphaFactor,
} from "three";
import { applyItemKartPresentation } from "./item-kart-presentation";

/** A kart view: two meshes sharing a material, a glowing (already blended) part and a balloon. */
function kart() {
  const root = new Group();
  const paint = new MeshBasicMaterial();
  const glow = new MeshBasicMaterial({ transparent: true });
  const body = new Mesh(new BoxGeometry(), paint);
  const wing = new Mesh(new BoxGeometry(), paint);
  const light = new Mesh(new BoxGeometry(), glow);
  const balloon = new Group();
  root.add(body, wing, light, balloon);
  return { root, paint, glow, body, wing, light, balloon, trails: { visible: true } };
}

const draw = (mesh: Mesh) => {
  mesh.onBeforeRender(undefined as never, undefined as never, undefined as never, mesh.geometry,
    mesh.material as never, undefined as never);
  const material = mesh.material as MeshBasicMaterial;
  const during = { blending: material.blending, src: material.blendSrc, dst: material.blendDst,
    alpha: material.blendAlpha };
  mesh.onAfterRender(undefined as never, undefined as never, undefined as never, mesh.geometry,
    mesh.material as never, undefined as never);
  return during;
};

test("other teams lose an invisible kart and its trails; they come back after", () => {
  const view = kart();
  applyItemKartPresentation({ root: view.root, extras: [view.trails], balloon: view.balloon },
    { opacity: 0, balloonVisible: true });
  assert.equal(view.root.visible, false);
  assert.equal(view.trails.visible, false);
  assert.equal(view.balloon.visible, true);
  view.root.visible = true; // the racer view decides again every frame
  applyItemKartPresentation({ root: view.root, extras: [view.trails], balloon: view.balloon }, undefined);
  assert.equal(view.root.visible, true);
  assert.equal(view.trails.visible, true);
  // Trails the race keeps hidden stay hidden.
  const hidden = { visible: false };
  applyItemKartPresentation({ root: view.root, extras: [hidden] }, { opacity: 0, balloonVisible: true });
  applyItemKartPresentation({ root: view.root, extras: [hidden] }, undefined);
  assert.equal(hidden.visible, false);
});

test("teammates see it translucent: constant alpha around each mesh's own draw, drawn last", () => {
  const view = kart();
  applyItemKartPresentation({ root: view.root }, { opacity: 0.35, balloonVisible: true });
  assert.equal(view.root.visible, true);
  assert.deepEqual([view.body.renderOrder, view.wing.renderOrder, view.light.renderOrder],
    [1_000_000, 1_000_000, 1_000_000]);
  assert.deepEqual(draw(view.body), { blending: CustomBlending, src: ConstantAlphaFactor,
    dst: OneMinusConstantAlphaFactor, alpha: 0.35 });
  // The shared material is back to its own blend between draws (another kart may use it).
  assert.equal(view.paint.blending, NormalBlending);
  assert.equal(draw(view.light).blending, NormalBlending, "already blended parts keep their blend");
  applyItemKartPresentation({ root: view.root }, { opacity: 0.5, balloonVisible: true });
  assert.equal(draw(view.wing).alpha, 0.5);
  applyItemKartPresentation({ root: view.root }, undefined);
  assert.equal(view.body.renderOrder, 0);
  assert.equal(draw(view.body).blending, NormalBlending);
});

test("a popping balloon hides until Reborn", () => {
  const view = kart();
  applyItemKartPresentation({ root: view.root, balloon: view.balloon }, { opacity: 1, balloonVisible: false });
  assert.equal(view.balloon.visible, false);
  assert.equal(view.body.renderOrder, 0);
  applyItemKartPresentation({ root: view.root, balloon: view.balloon }, undefined);
  assert.equal(view.balloon.visible, true);
});
