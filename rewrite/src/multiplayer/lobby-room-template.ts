/** Prepare the released lobby room scene for rider slots and mode controls. */

export interface RoomTemplateNode {
  name: string;
  children: RoomTemplateNode[];
  attributes: { name: string; value: string | undefined }[];
  [key: string]: unknown;
}

export interface RoomTemplateDependencies {
  attribute(node: RoomTemplateNode, name: string): string | undefined;
  clone(node: RoomTemplateNode, attributes: Record<string, string | undefined>,
    children?: RoomTemplateNode[]): RoomTemplateNode;
}

export interface TeamCardTemplate { cardTexture: string }

export interface RoomTemplateLoaderDependencies extends RoomTemplateDependencies {
  loadDefinition(library: unknown, folder: string, name: string):
    Promise<RoomTemplateNode>;
  loadRoleTeams(library: unknown): Promise<TeamCardTemplate[]>;
}

export async function loadLobbyRoomTemplate(library: unknown,
  roadblock: boolean, dependencies: RoomTemplateLoaderDependencies):
  Promise<RoomTemplateNode | undefined> {
  const [root, riderCard, teams, difficulty, talkBalloon] = await Promise.all([
    dependencies.loadDefinition(library, "stage_/mqReady", "stage_window@zz"),
    dependencies.loadDefinition(library, "stage_/mqReady", "riderCard@zz"),
    dependencies.loadRoleTeams(library),
    dependencies.loadDefinition(library, "gui_/windowTemplate", "trackDifficulty"),
    dependencies.loadDefinition(library, "stage_/mqReady", "talkBalloon@zz"),
  ]);
  return buildLobbyRoomTemplate(root, riderCard, teams, difficulty,
    talkBalloon, roadblock, dependencies);
}

const slotPartNames = new Set([
  "riderNameLabel", "bossTag_me", "bossTag_other", "ready", "changing",
  "closed", "kick", "info", "myRiderTag",
]);
const alwaysVisibleNames = new Set([
  "readyButtonCont", "teamReadyButtonCont", "ready", "cancel", "start",
  "start_count", "cancel_count", "autoCount", "changeRoomInfo",
  "changeRoomInfoNotPassword", "changeRoomInfoPassword",
]);

export function buildLobbyRoomTemplate(
  root: RoomTemplateNode, riderCard: RoomTemplateNode,
  teams: TeamCardTemplate[] = [], difficulty?: RoomTemplateNode,
  talkBalloon?: RoomTemplateNode, roadblock = false,
  dependencies?: RoomTemplateDependencies,
): RoomTemplateNode | undefined {
  if (!dependencies) throw new Error("Lobby room template dependencies are required");
  const { attribute, clone } = dependencies;
  if (roadblock) {
    for (const part of ["runnerTag", "blockerTag", "runnerHandicap"]) {
      if (!riderCard.children.some(child => attribute(child, "name") === part)) {
        throw new Error(`挡人房间缺少 ${part} 原件。`);
      }
    }
    const hasRoadblockTime = (node: RoomTemplateNode): boolean =>
      attribute(node, "name") === "roadBlockTime" ||
      node.children.some(hasRoadblockTime);
    if (!hasRoadblockTime(root)) throw new Error("挡人房间缺少限制时间原件。");
  }

  const slotParts = riderCard.children.filter(node =>
    slotPartNames.has(attribute(node, "name") ?? "") ||
    attribute(node, "texture") === "img_slotEmblemBG");

  function transform(node: RoomTemplateNode): RoomTemplateNode | undefined {
    const name = attribute(node, "name") ?? "";
    if (node.name === "Skip") return undefined;
    const showHidden = alwaysVisibleNames.has(name) ||
      (roadblock && name === "roadBlockTime");
    if ((attribute(node, "visible") === "false" && !showHidden) ||
      name === "요일모드" || name === "recording") return undefined;

    if (name === "gameType") return clone(node, { leftTopWH: "454 0 150 50" });
    if (name === "roadBlockTime") return clone(node, { visible: "true" });
    if (name === "trackTheme") return {
      ...node, attributes: node.attributes.filter(part => part.name !== "texture"),
    };
    if (node.name === "TrackCard" && difficulty) {
      const label = clone(difficulty, {
        name: "roomTrackDifficulty", visible: "true",
        align: attribute(node, "difficultyAlign") as string,
        adjust: attribute(node, "difficultyAdjust") as string,
      }, difficulty.children.map(child => clone(child, {
        name: `roomTrackDifficulty/${attribute(child, "name")}`,
        resourceRoot: "gui_/windowTemplate",
      })));
      return { ...node, children: [...node.children, label] };
    }
    if (/^rider[0-7]$/.test(name)) {
      const prefix = `${name}/`;
      const clonedParts = slotParts.map((part, index) => {
        const partName = attribute(part, "name");
        if (partName === "closed") {
          const closedPanel = {
            ...part, name: "Panel",
            attributes: part.attributes.filter(field => field.name !== "autoLoadImage"),
          };
          return clone(closedPanel, { name: prefix + partName,
            texture: "btn_slotClose_1" });
        }
        return clone(part, { name: prefix +
          (partName ?? `emblemBackground${index}`) });
      });
      const slotBackground = (texture: string, hover = false) => clone(
        riderCard,
        { name: prefix + texture + (hover ? "Hover" : ""),
          texture: texture.replace(/_1$/, hover ? "_1" : "_2") }, []);
      const teamBackgrounds = teams.flatMap((team, index) =>
        [false, true].map(hover => clone(slotBackground(team.cardTexture, hover),
          { name: prefix + `teamBackground${index + 1}${hover ? "Hover" : ""}` })));
      const roadblockBackgrounds = roadblock
        ? ["red", "blue"].flatMap(color => [false, true].map(hover =>
          clone(slotBackground(`ridercard_${color}_roadBlock_1`, hover), {
            name: prefix + `roadBlockBackground/${color}${hover ? "Hover" : ""}`,
          })))
        : [];
      const roadblockCovers = roadblock
        ? ["red", "blue"].map(color =>
          clone(slotBackground(`ridercard_${color}_roadBlock_Cover`), {
            name: prefix + `roadBlockCover/${color}`,
          }))
        : [];
      const roadblockTags = roadblock
        ? ["runnerTag", "blockerTag", "runnerHandicap"].map(part =>
          clone(riderCard.children.find(child => attribute(child, "name") === part)!, {
            name: prefix + part, visible: "true",
            align: part === "runnerHandicap" ? "hcenter" : "right",
          }))
        : [];
      const preview: RoomTemplateNode = {
        name: "Panel", text: "",
        attributes: [
          { name: "name", value: prefix + "preview" },
          { name: "windowRect", value: attribute(riderCard, "riderRect") ??
            "-5 0 245 308" },
        ],
        children: [],
      };
      const teamCovers = teams.map((team, index) =>
        clone(slotBackground(team.cardTexture.replace(/1$/, "Cover")), {
          name: prefix + `teamCover${index + 1}`,
        }));
      const balloon = talkBalloon && clone(talkBalloon,
        { name: prefix + "talkBalloon", visible: "true" },
        talkBalloon.children.map(child => clone(child, {
          name: prefix + `talkBalloon/${attribute(child, "name") ?? "nametag"}`,
        })));
      const closed = clonedParts.find(part =>
        attribute(part, "name") === prefix + "closed");
      const partsAndHover = closed
        ? [...clonedParts, clone(closed, { name: prefix + "closedHover",
          texture: "btn_slotClose_2" })]
        : clonedParts;
      return { ...node, children: [
        slotBackground("btn_singleEmptySlot1_1"),
        slotBackground("btn_singleEmptySlot1_1", true),
        slotBackground("btn_singleSlot1_1"),
        slotBackground("btn_singleSlot1_1", true),
        ...teamBackgrounds, ...roadblockBackgrounds, preview,
        clone(slotBackground("btn_singleSlotCover"), {
          name: prefix + "singleCover" }),
        ...teamCovers, ...roadblockCovers, ...partsAndHover, ...roadblockTags,
        ...(balloon ? [balloon] : []),
      ] };
    }
    return { ...node, children: node.children.map(transform).filter(
      (child): child is RoomTemplateNode => !!child) };
  }

  return transform(root);
}

export function addLobbyEmotionWheel(root: RoomTemplateNode,
  emotions: { label: string }[], dependencies: RoomTemplateDependencies):
  RoomTemplateNode {
  const element = (tag: string, name: string, rect: string, text?: string,
    children: RoomTemplateNode[] = []): RoomTemplateNode => ({
    name: tag, text: "",
    attributes: Object.entries({
      name, leftTopWH: rect,
      ...(text === undefined ? {} : { text, textRender: "bold16" }),
    }).map(([field, value]) => ({ name: field, value })),
    children,
  });
  const buttons = emotions.map((emotion, index) => element("TextButton",
    `roomEmotion/${index}`,
    `${8 + (index % 2) * 122} ${8 + Math.floor(index / 2) * 40} 116 34`,
    `${index + 1} ${emotion.label}`));
  const wheel = dependencies.clone(element("Panel", "roomEmotionWheel",
    "214 566 252 176", undefined, buttons), { color: "232 23 44 77" });
  return { ...root, children: [
    ...root.children, wheel,
    element("TextButton", "roomEmotionToggle", "368 744 98 34", "表情"),
  ] };
}
