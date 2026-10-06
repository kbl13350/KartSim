export interface RandomTrackGroup {
  id: string;
  trackIds: string[];
  gameType: string;
  selectionGameTypes?: string[];
}

export interface RandomTrackCandidate {
  id: string;
  gameType: string;
}

/** A random card may select tracks from several compatible game modes. */
export function randomGroupAcceptsGameType(group: RandomTrackGroup, gameType: string): boolean {
  return (group.selectionGameTypes ?? [group.gameType]).includes(gameType);
}

/** Avoid repeats within one random pool until every eligible track has appeared. */
export class RandomTrackSession {
  activeGroupId: string | undefined;
  used = new Set<string>();

  constructor(readonly random: () => number = Math.random) {}

  selectGroup(groupId: string | undefined): void {
    if (this.activeGroupId !== groupId) {
      this.activeGroupId = groupId;
      this.used.clear();
    }
  }

  pick<Track extends RandomTrackCandidate>(group: RandomTrackGroup, tracks: Track[]): Track {
    const eligible = tracks.filter(track =>
      group.trackIds.includes(track.id) && randomGroupAcceptsGameType(group, track.gameType));
    if (eligible.length === 0) {
      throw new Error(`随机池 ${group.id} 没有可加载的 ${group.gameType} 赛道。`);
    }
    this.selectGroup(group.id);
    let unused = eligible.filter(track => !this.used.has(track.id));
    if (unused.length === 0) {
      this.used.clear();
      unused = eligible;
    }
    const index = Math.min(unused.length - 1,
      Math.max(0, Math.floor(this.random() * unused.length)));
    const selected = unused[index]!;
    this.used.add(selected.id);
    return selected;
  }

  clear(): void {
    this.selectGroup(undefined);
  }
}
