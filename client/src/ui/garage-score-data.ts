export interface GarageScoreXmlNode {
  name: string;
  children: GarageScoreXmlNode[];
}

export type GarageScoreAttribute = (node: GarageScoreXmlNode,
  name: string) => string | undefined;

export interface GarageSkillScore {
  TransAccelFactor: number;
  DriftEscapeForce: number;
  NormalBoosterTime: number;
  DriftMaxGauge: number;
}

const SKILL_SCORE_ATTRIBUTES: Record<keyof GarageSkillScore, string> = {
  TransAccelFactor: "transAccelFactor",
  DriftEscapeForce: "driftEscapeForce",
  NormalBoosterTime: "normalBoosterTime",
  DriftMaxGauge: "driftMaxGauge",
};

const SCORE_FIELDS = [
  "TransAccelFactor", "DriftEscapeForce", "SteerConstraint",
  "NormalBoosterTime", "DriftMaxGauge",
] as const;

function zeroSkillScore(): GarageSkillScore {
  return { TransAccelFactor: 0, DriftEscapeForce: 0,
    NormalBoosterTime: 0, DriftMaxGauge: 0 };
}

function skillInteger(text: string | undefined): number {
  if (text === undefined || !text.trim() || !Number.isSafeInteger(Number(text)))
    throw new Error("迅技能评分数值无效。");
  return Number(text);
}

/** Decode all nine XUN skills and their five upgrade levels. */
export function parseGarageSkillScoreTable(
  tuningData: GarageScoreXmlNode,
  abilityList: GarageScoreXmlNode,
  attribute: GarageScoreAttribute,
): Map<number, GarageSkillScore[]> {
  if (tuningData.name !== "kart12TuningData" ||
      abilityList.name !== "TuneAbilityList")
    throw new Error("迅技能评分资源根节点无效。");
  const skillSets = tuningData.children.filter(node => node.name === "tuningSkillSet");
  if (skillSets.length !== 1) throw new Error("迅技能组缺失或重复。");
  const scores = new Map<number, GarageSkillScore[]>();
  for (let skill = 1; skill <= 9; skill++) {
    const rows = skillSets[0]!.children.filter(node => node.name === "Skill" &&
      attribute(node, "idx") === String(skill));
    if (rows.length !== 1)
      throw new Error(`迅技能 ${skill} 缺失或重复。`);
    const groupId = skillInteger(attribute(rows[0]!, "tuneGroupId"));
    const groups = abilityList.children.filter(node => node.name === "TuneGroup" &&
      attribute(node, "id") === String(groupId));
    if (groups.length !== 1)
      throw new Error(`迅技能效果组 ${groupId} 缺失或重复。`);
    const levels: GarageSkillScore[] = [zeroSkillScore()];
    for (let level = 1; level <= 5; level++) {
      const tunes = groups[0]!.children.filter(node => node.name === "Tune" &&
        attribute(node, "id") === String(level));
      if (tunes.length !== 1)
        throw new Error(`迅技能 ${skill}/${level} 缺失或重复。`);
      const score = zeroSkillScore();
      for (const effect of tunes[0]!.children) {
        if (effect.name !== "EnchanterAddSpec")
          throw new Error("迅竞速技能评分遇到未支持的效果类型。");
        const uiValues = effect.children.filter(node => node.name === "UiValue");
        if (uiValues.length > 1) throw new Error("迅技能 UiValue 重复。");
        for (const key of Object.keys(SKILL_SCORE_ATTRIBUTES) as
          Array<keyof GarageSkillScore>) {
          score[key] += uiValues[0] ?
            skillInteger(attribute(uiValues[0], SKILL_SCORE_ATTRIBUTES[key]) ?? "0") : 0;
          if (!Number.isSafeInteger(score[key]))
            throw new Error("迅技能评分溢出。");
        }
      }
      levels.push(score);
    }
    scores.set(skill, levels);
  }
  return scores;
}

export interface GarageScoreGradeRange {
  min: number;
  max: number;
  unit: number;
}

function scoreNumber(text: string): number {
  if (!text.trim()) throw new Error("车库评分数值为空。");
  const value = Math.fround(Number(text));
  if (!Number.isFinite(value))
    throw new Error("车库评分包含非有限数值。");
  return value;
}

/** Read native part-score ranges by engine generation and part quality. */
export function parseGaragePartGradeGrid(root: GarageScoreXmlNode,
  attribute: GarageScoreAttribute):
  Map<number, Map<string, GarageScoreGradeRange[]>> {
  const sections = root.children.filter(node => node.name === "gradeSection");
  if (sections.length !== 1)
    throw new Error("部件评分档位组缺失或重复。");
  const grid = new Map<number, Map<string, GarageScoreGradeRange[]>>();
  for (const gradeNode of sections[0]!.children.filter(node => node.name === "grade")) {
    const engineGrade = scoreNumber(attribute(gradeNode, "engineGrade") ?? "");
    if (!Number.isInteger(engineGrade) || grid.has(engineGrade))
      throw new Error("部件评分车代无效或重复。");
    const fields = new Map<string, GarageScoreGradeRange[]>();
    for (const field of SCORE_FIELDS.slice(0, 4)) {
      const matching = gradeNode.children.filter(node => node.name === "section" &&
        attribute(node, "param") === field);
      if (matching.length !== 1)
        throw new Error(`部件评分档位缺失或重复：${field}。`);
      const ranges = ["normal", "rare", "legend", "unique"].map(quality => {
        const rows = matching[0]!.children.filter(node => node.name === quality);
        if (rows.length !== 1)
          throw new Error("部件品质档位缺失或重复。");
        const range = {
          min: scoreNumber(attribute(rows[0]!, "min") ?? ""),
          max: scoreNumber(attribute(rows[0]!, "max") ?? ""),
          unit: scoreNumber(attribute(rows[0]!, "unit") ?? ""),
        };
        if (!Object.values(range).every(Number.isInteger) || range.min < 0 ||
            range.max > 65_535 || range.min > range.max || range.unit <= 0 ||
            (range.max - range.min) / range.unit !== 9)
          throw new Error("部件评分档位范围无效。");
        return range;
      });
      fields.set(field, ranges);
    }
    grid.set(engineGrade, fields);
  }
  return grid;
}
