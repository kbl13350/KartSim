import { licenseItemsOf } from "../license/license-item-race";
import { itemSlotInput } from "../ui/multiplayer-race-hud";

interface ParticipantProgress {
  id: string;
  name: string;
  lap: number;
  progress: number;
}

interface RankedParticipant extends ParticipantProgress { rank: number }

interface RaceHudPhysics {
  body: unknown;
  timeAttackTachometerGauges(): {
    mainRatio: number;
    teamRatio: number;
    teamBooster: boolean;
  };
  timeAttackSpeedSlots(): unknown;
  timeAttackSpeedSlotDisabled(): unknown;
  timeAttackSpeedSlotWindowStartMs(): number;
}

interface RaceHudTrack {
  data: { lapTarget?: number };
  getRouteState(physics: RaceHudPhysics): { lap: number; distance: number };
}

interface RaceHudRow {
  participantId: string;
  slot: number;
  rank: number;
  local: boolean;
  name: string;
  color: unknown;
}

export interface RaceHudRank {
  rank: number;
  riderCount: number;
  rows: RaceHudRow[];
}

export interface RaceHudStage {
  host: {
    session: {
      lifecycle: { bestLapMs: number | null };
      ghosts: Array<{ name?: string }>;
      rankColors?: unknown[];
      localName?: string;
      warpHud?: { hidden: boolean };
    };
    renderer: unknown;
    getPhysics(): RaceHudPhysics;
    getTrack(): RaceHudTrack;
  };
  interface?: {
    gameplayUi?: {
      update(values: unknown, nowMs: number, worldAxis: unknown, depthAxis: unknown): void;
      render(renderer: unknown, worldAxis: unknown, depthAxis: unknown): void;
    };
  };
  ghostRouteProgress: { distance(ghost: { name?: string }): number };
  rankBoardValues(): RaceHudRank;
}

export interface RaceHudDependencies {
  rankParticipants(participants: ParticipantProgress[]): RankedParticipant[];
  elapsedRaceMs(lifecycle: RaceHudStage["host"]["session"]["lifecycle"], nowMs: number): number;
  isRaceFinished(lifecycle: RaceHudStage["host"]["session"]["lifecycle"]): boolean;
  worldAxis: unknown;
  depthAxis: unknown;
}

/** Rank the local player and Ghosts and resolve their displayed names/colors. */
export function rankBoardValues(
  stage: RaceHudStage,
  dependencies: Pick<RaceHudDependencies, "rankParticipants">,
): RaceHudRank {
  const { host } = stage;
  const participants: ParticipantProgress[] = [
    {
      id: "player",
      name: "",
      lap: 0,
      progress: host.getTrack().getRouteState(host.getPhysics()).distance,
    },
    ...host.session.ghosts.map((ghost, index) => ({
      id: `ghost${index}`,
      name: "",
      lap: 0,
      progress: stage.ghostRouteProgress.distance(ghost),
    })),
  ];
  const ranked = dependencies.rankParticipants(participants);
  const player = ranked.find(participant => participant.id === "player");
  if (!player) throw new Error("TimeAttack rank board 缺少本地玩家。");
  const colors = host.session.rankColors ?? [];
  return {
    rank: player.rank,
    riderCount: participants.length,
    rows: ranked.map(participant => ({
      participantId: participant.id,
      slot: participant.id === "player" ? 0 : Number(participant.id.slice(5)) + 1,
      rank: participant.rank,
      local: participant.id === "player",
      name: participant.id === "player"
        ? host.session.localName || "自己"
        : host.session.ghosts[Number(participant.id.slice(5))]?.name ?? "",
      color: colors[participant.id === "player" ? 0 : Number(participant.id.slice(5)) + 1],
    })),
  };
}

/** Feed the current route, speed slots, boost gauges and ranks to the HUD. */
export function renderGameplayUi(
  stage: RaceHudStage,
  nowMs: number,
  ghostPoses: unknown,
  dependencies: Omit<RaceHudDependencies, "rankParticipants">,
): void {
  const { host } = stage;
  const gameplayUi = stage.interface?.gameplayUi;
  if (!gameplayUi) return;
  const lapTarget = host.getTrack().data.lapTarget;
  if (lapTarget === undefined) {
    throw new Error("TimeAttack gameplay UI 缺少 lapTarget。 ");
  }
  const gauges = host.getPhysics().timeAttackTachometerGauges();
  // 驾照考试 item steps show the item slots, aim and notices of 道具赛.
  const items = licenseItemsOf(host.session);
  const itemState = items?.hudState();
  gameplayUi.update({
    body: host.getPhysics().body,
    currentLap: host.getTrack().getRouteState(host.getPhysics()).lap,
    totalLaps: lapTarget,
    elapsedMs: dependencies.elapsedRaceMs(host.session.lifecycle, nowMs),
    bestMs: host.session.lifecycle.bestLapMs,
    ...(itemState ? itemSlotInput(itemState) : {
      speedSlots: host.getPhysics().timeAttackSpeedSlots(),
      speedSlotDisabled: host.getPhysics().timeAttackSpeedSlotDisabled(),
      speedSlotWindowStartMs: host.getPhysics().timeAttackSpeedSlotWindowStartMs(),
    }),
    boostRatio: gauges.mainRatio,
    teamBoostRatio: gauges.teamRatio,
    teamBooster: gauges.teamBooster,
    rank: stage.rankBoardValues(),
    ghosts: ghostPoses,
  }, nowMs, dependencies.worldAxis, dependencies.depthAxis);
  items?.hud?.update(nowMs, gameplayUi as never);
  if (!dependencies.isRaceFinished(host.session.lifecycle) &&
      !host.session.warpHud?.hidden) {
    // The width and height of the HUD canvas.
    const [width, height] = [Number(dependencies.worldAxis), Number(dependencies.depthAxis)];
    items?.hud?.renderUnder(host.renderer, width, height);
    gameplayUi.render(host.renderer, dependencies.worldAxis, dependencies.depthAxis);
    items?.hud?.renderOver(host.renderer, width, height);
  }
}
