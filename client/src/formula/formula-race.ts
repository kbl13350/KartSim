import type { FormulaDifficulty, FormulaGroupId, FormulaRound } from "./formula-data";
import type { FormulaRoundResult } from "./formula-engine";

/** A local championship round carried through the existing solo race lifecycle.
 * Runtime writes result only after settling the round; exiting early leaves it absent. */
export interface FormulaRaceRequest {
  difficulty: FormulaDifficulty;
  groupId: FormulaGroupId;
  round: FormulaRound;
  trackId: string;
  playerName?: string;
  result?: FormulaRoundResult;
}
