import assert from "node:assert/strict";
import test from "node:test";
import { decodeBinaryXml } from "../codecs/binary-xml";
import { decodePngRgba } from "../resources/png-decoder";
import { mirrorArchives } from "../resources/mirror-archives.test-support";
import { U1 } from "../generated/library.js";
import { loadTrainingCatalog, loadTrainingLessonArt, loadTrainingPageArt,
  type TrainingLibrary, type TrainingNode, type TrainingTextureLoader } from "../training/training-catalog";

/** Only the training resources are mounted; no server or browser is needed. */
function nativeLibrary(): TrainingLibrary {
  const mirror = mirrorArchives();
  const files = new Map<string, { bytes(): Promise<Uint8Array> }>();
  for (const [archive, mount] of [["stage_mainMenu.rho", "stage_/mainMenu"],
    ["stage_trainingCenterReady.rho", "stage_/trainingCenterReady"],
    ["gui_monocoque.rho", "gui_/monocoque"], ["stage_common.rho", "stage_/common"],
    ["zeta_cn_stage.rho", "zeta_/cn/stage"]]) {
    const index = mirror.index.rho.find(item => item.name === archive)!;
    for (const file of index.files as readonly { path: string }[])
      files.set(`${mount}/${file.path}`.toLowerCase(), { bytes: () => mirror.read(archive!, file.path) });
  }
  const pack = mirror.index.rho5.find(item => item.name === "DataPack1")!;
  for (const file of (pack.files as readonly { path: string }[])
    .filter(file => file.path.startsWith("etc_/trainingCenter/")))
    files.set(file.path.toLowerCase(), { bytes: () => mirror.read("DataPack1", file.path) });
  return { canonicalCandidates: path => files.has(path.toLowerCase()) ? [files.get(path.toLowerCase())!] : [] };
}

test("original training XML restores all twelve courses and their mission settings", async () => {
  const catalog = await loadTrainingCatalog(nativeLibrary());
  assert.deepEqual(catalog.levels.map(level => [level.level, level.lessons.length]), [[1, 4], [2, 4], [3, 4]]);
  assert.deepEqual(catalog.lessons.map(lesson => lesson.id),
    ["11", "12", "13", "14", "21", "22", "23", "24", "31", "32", "33", "34"]);
  assert.equal(catalog.lessons[0]!.track, "village_L03_03_short");
  assert.equal(catalog.lessons[5]!.parameters.detectSkill, "3");
  assert.equal(catalog.lessons[5]!.parameters.detectCheckNum, "3,6");
  assert.equal(catalog.lessons[8]!.parameters.lap, "2");
  assert.equal(catalog.lessons[8]!.kartId, 1518);
  assert.equal(catalog.lessons[10]!.track, "wkc_L01");
  assert.equal(catalog.lessons[0]!.subjects[0]!.title, "起步加速的使用");
  assert.match(catalog.lessons[0]!.subjects[0]!.description, /倒计时/);
  assert.deepEqual(catalog.lessons[5]!.missions[1], { phase: 1,
    items: [{ id: 0, key: "useCuttingDrift" }, { id: 1, key: "CompleteInLimit" }] });
});

test("every restored lesson has original state icons, frames and intact 376×150 teaching art", async () => {
  const library = nativeLibrary();
  const catalog = await loadTrainingCatalog(library);
  const texture: TrainingTextureLoader = async (roots, name) => {
    try {
      const file = U1(library, roots, name) as { bytes(): Promise<Uint8Array> };
      const decoded = await decodePngRgba(await file.bytes());
      return { image: {} as CanvasImageSource, width: decoded.width, height: decoded.height };
    } catch { return undefined; }
  };
  const art = await loadTrainingPageArt(library, texture, async () => decodeBinaryXml(
    await (U1(library, ["gui_/monocoque"], "frame", ".bml") as
      { bytes(): Promise<Uint8Array> }).bytes()) as unknown as TrainingNode, catalog);
  assert.equal(art.frames.length, 4);
  assert.equal(art.icons.size, 12);
  assert.equal(art.textures.size, 3);
  for (const lesson of catalog.lessons) {
    assert.equal(art.icons.get(lesson.id)?.length, 4, lesson.id);
    const lessonArt = await loadTrainingLessonArt(library, lesson, texture);
    assert.ok(lessonArt.backdrop);
    assert.ok(lessonArt.titleBar);
    for (const subject of lessonArt.subjects)
      assert.deepEqual([subject.image.width, subject.image.height], [376, 150], subject.imagePath);
  }
});

test("training explanations use English text and the original Korean string bag", async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const locale of ["en", "ko"]) {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => locale } });
      const catalog = await loadTrainingCatalog(nativeLibrary());
      for (const lesson of catalog.lessons) {
        assert.doesNotMatch(lesson.title, /\p{Script=Han}/u);
        for (const subject of lesson.subjects) {
          assert.doesNotMatch(subject.description, /\p{Script=Han}/u);
          assert.ok(subject.description.length > 0);
        }
      }
      assert.match(catalog.lessons[0]!.title, locale === "en" ? /Start boost/ : /출발/);
    }
  } finally {
    if (saved) Object.defineProperty(globalThis, "localStorage", saved);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("a missing teaching illustration is reported instead of opening an empty lesson", async () => {
  const library = nativeLibrary();
  const catalog = await loadTrainingCatalog(library);
  await assert.rejects(loadTrainingLessonArt(library, catalog.lessons[0]!, async () => undefined),
    /Missing training illustration.*11\/01@cn.png/);
});
