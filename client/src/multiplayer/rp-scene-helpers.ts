/** RP scene camera and result panel rules verified against the released assets. */

import type { RoomTemplateDependencies, RoomTemplateNode } from
  "./lobby-room-template";

export interface RpCameraMatrices {
  view: number[];
  projection: number[];
}

export function rpSceneCameraMatrices(node: RoomTemplateNode, width: number,
  height: number, attribute: RoomTemplateDependencies["attribute"]):
  RpCameraMatrices {
  const vector = (name: string, fallback: number[]) => {
    const text = attribute(node, name);
    const values = text === undefined ? fallback
      : text.trim().split(/\s+/).map(Number);
    if (values.length !== 3 || values.some(value => !Number.isFinite(value))) {
      throw new Error(`RP ${name} 无效。`);
    }
    return values.map(Math.fround);
  };
  const eye = vector("defaultCameraPos", [0, -2.5, 0.949999988079071]);
  const target = vector("defaultSpotPos", [0, 0, 0.30000001192092896]);
  if (eye[0] !== target[0] || !(eye[1]! < target[1]!) ||
    Number(attribute(node, "zoom")) !== 1 ||
    ["camera", "customCamera", "orthographic", "useRelCamera"].some(name =>
      attribute(node, name) !== undefined && attribute(node, name) !== "false")) {
    throw new Error("RP 场景相机超出已核实的 P3553 分支。");
  }
  if (!(width > 0 && height > 0)) {
    throw new Error("RP 场景窗口尺寸无效。");
  }
  const f32 = Math.fround;
  const depth = f32(eye[1]! - target[1]!);
  const rise = f32(eye[2]! - target[2]!);
  const distance = f32(Math.sqrt(f32(f32(depth * depth) + f32(rise * rise))));
  const forwardY = f32(depth / distance);
  const forwardZ = f32(rise / distance);
  const view = [
    1, 0, 0, -eye[0]!,
    0, forwardZ, f32(-forwardY),
    f32(-f32(f32(forwardZ * eye[1]!) +
      f32(f32(-forwardY) * eye[2]!))) + 0,
    0, f32(-forwardY), f32(-forwardZ) + 0,
    f32(f32(forwardY * eye[1]!) + f32(forwardZ * eye[2]!)),
  ];
  const aspect = f32(f32(height) / f32(width));
  const fieldScale = 0.7673262357711792;
  const farScale = f32(1000 / f32(999));
  return {
    view,
    projection: [
      f32(1 / fieldScale), 0, 0, 0,
      0, f32(1 / f32(fieldScale * aspect)), 0, 0,
      0, 0, farScale, f32(-farScale),
      0, 0, 1, 0,
    ],
  };
}

interface MatrixLike {
  elements: number[];
  copy(matrix: MatrixLike): MatrixLike;
  invert(): MatrixLike;
}

export interface RpCameraLike {
  near: number;
  far: number;
  aspect: number;
  fov: number;
  matrixWorldInverse: MatrixLike;
  matrixWorld: MatrixLike;
  projectionMatrix: MatrixLike;
  projectionMatrixInverse: MatrixLike;
}

export function configureRpSceneCamera(camera: RpCameraLike,
  node: RoomTemplateNode, width: number, height: number,
  dependencies: {
    attribute: RoomTemplateDependencies["attribute"];
    applyMatrices(camera: RpCameraLike, view: number[], projection: number[]): void;
  }): void {
  const { view, projection } = rpSceneCameraMatrices(node, width, height,
    dependencies.attribute);
  camera.near = 1;
  camera.far = 1000;
  camera.aspect = width / height;
  camera.fov = 2 * Math.atan(0.7673262357711792 * height / width)
    * 180 / Math.PI;
  dependencies.applyMatrices(camera, view, projection);
  for (const index of [2, 6, 10, 14]) {
    camera.matrixWorldInverse.elements[index]! *= -1;
  }
  for (const index of [8, 9, 10, 11]) {
    camera.projectionMatrix.elements[index]! *= -1;
  }
  camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

export function decorateRpResultTemplate(root: RoomTemplateNode,
  kartTitle: string, petTitle: string,
  dependencies: RoomTemplateDependencies): RoomTemplateNode {
  const { attribute, clone } = dependencies;
  const dialog = root.children.find(child =>
    attribute(child, "name") === "noticeDlg");
  if (!dialog || !attribute(dialog, "frame")) {
    throw new Error("RP 缺少原版结果窗口。");
  }
  const box = root.children.find(child => attribute(child, "name") === "boxOpen");
  const outcomes = dialog.children.filter(child =>
    ["꽝", "당첨"].includes(attribute(child, "name") ?? ""));
  const main = dialog.children.find(child => attribute(child, "name") === "main");
  if (!box || box.children[0]?.name !== "Play1SPanel" ||
    outcomes.length !== 2 || !main ||
    !outcomes.some(child => attribute(child, "name") === "당첨" &&
      child.children[0]?.name === "Play1SPanel")) {
    throw new Error("RP 缺少原版开箱/欧非结果资源。");
  }
  const label = (name: string, rect: string, text: string,
    font: string): RoomTemplateNode => ({
    name: "Label", text: "",
    attributes: Object.entries({
      name, leftTopWH: rect, text, textAlign: "center", textColor: "black",
      textRender: font, multiLine: "true", autoWrap: "true",
    }).map(([field, value]) => ({ name: field, value })),
    children: [],
  });
  return { ...root, children: [
    box,
    clone(dialog, { visible: "false" }, [
      ...outcomes, main,
      label("rpKart", "20 267 450 36", kartTitle, "bold20"),
      label("rpPet", "20 307 450 32", `飞宠：${petTitle}`, "bold16"),
    ]),
  ] };
}
