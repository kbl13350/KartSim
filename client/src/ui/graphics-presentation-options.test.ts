import assert from "node:assert/strict";
import test from "node:test";
import { addGraphicsPresentationOptions } from "./graphics-presentation-options";

test("graphics presentation control preserves the resource tree and is not duplicated", () => {
  const original = { name: "Container", text: "", attributes: [], children: [{
    name: "Window", text: "", attributes: [{ name: "name", value: "graphic" }],
    children: [{ name: "Panel", text: "", attributes: [], children: [] }],
  }] };
  const copy = structuredClone(original);
  const result = addGraphicsPresentationOptions(original);
  assert.deepEqual(original, copy);
  assert.equal(result.children[0]!.children.length, 2);
  assert.equal(result.children[0]!.children[0], original.children[0]!.children[0]);
  const control = result.children[0]!.children[1]!;
  assert.equal(control.children[0]!.name, "PlaneCheckButton");
  assert.ok(control.children[0]!.attributes.some(attribute =>
    attribute.name === "name" && attribute.value === "verticalSync"));
  assert.deepEqual(addGraphicsPresentationOptions(result), result);
});

test("unrelated graphics and sound buttons retain their style lookup identity", () => {
  const button = { name: "TextButton", text: "", attributes: [], children: [] };
  const definition = { name: "Window", text: "", attributes: [], children: [button] };
  assert.equal(addGraphicsPresentationOptions(definition), definition);
  assert.equal(addGraphicsPresentationOptions(definition).children[0], button);
});
