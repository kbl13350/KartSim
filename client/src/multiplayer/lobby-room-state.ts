import { translatedRoomChat } from "./chat-translation";
import { tr } from "../i18n/locale";
/** Maps a room UI node to its live presentation and command state. */

import { paintDeveloperBadge } from "../ui/developer-badge";
import { paintRandomTeamToggle } from "../ui/random-team-art";
import { BRAWL_LABEL } from "./lobby-brawl-mode";
import { itemModeLabel } from "./lobby-item-mode";

interface RoomMember {
  gm?: boolean;
  playerId: string;
  name: string;
  ready?: boolean;
  changing?: boolean;
  team?: number;
}

interface RoomSlot {
  slot: number;
  open: boolean;
  member?: RoomMember;
}

interface RoomChatLine {
  playerId: string;
  name: string;
  text: string;
}

interface RoomSnapshot {
  name: string;
  speed: number;
  mode: string;
  phase: string;
  hostId: string;
  capacity: number;
  members: RoomMember[];
  chat?: RoomChatLine[];
  channelName?: string;
  locked?: boolean;
  autoStartAt?: number;
  kickVote?: { yesIds: unknown[]; eligibleIds: unknown[] };
  /** 隊伍隨機分配 (team rooms): the server deals the teams when the race starts. */
  randomTeam?: boolean;
  race?: { roadblock?: { noRunnerManualReset?: boolean; limitMs?: number } };
}

interface RoomRect { x: number; y: number; width: number; height: number }
interface PaintContext {
  drawImage(image: unknown, x: number, y: number, width: number,
    height: number): void;
}

interface Emotion { marker: string }

export interface LobbyRoomStateHost {
  room: RoomSnapshot;
  playerId: string;
  busy: boolean;
  connected: boolean;
  chatSending: boolean;
  chatDraft: string;
  emotionWheelOpen: boolean;
  emotions: Emotion[];
  bubbles: Map<string, { text: string; until: number }>;
  previews?: { paint(playerId: string, canvas: PaintContext, rect: RoomRect,
    nowMs: number): void };
  countdown?: { paint(canvas: PaintContext, rect: RoomRect,
    elapsed: number): void };
  view?: { hoveredRegionId?: string };
  trackImage?: unknown;
  trackReverseStamp?: unknown;
  trackIcon?: unknown;
  trackDifficulty?: number;
  trackTitle: string;
  readonly countdownLocked: boolean;
  actions: {
    slot(slot: number, closed: boolean): unknown;
    kick(member: RoomMember): unknown;
    transfer(member: RoomMember): unknown;
    leave(): unknown;
    ready(ready: boolean): unknown;
    onStartActivate?: () => unknown;
    settings?: () => unknown;
    start?: () => unknown;
    canStart?: () => boolean;
    team(): unknown;
    garage?: () => unknown;
    track?: () => unknown;
    /** 隊伍隨機分配 switch (host of a team room). */
    randomTeam?: (enabled: boolean) => unknown;
  };
  toggleEmotionWheel(): void;
  closeEmotionWheel(): void;
  sendEmotion(emotion: Emotion): void;
  sendChat(): void;
  countdownState(): { active: boolean; elapsed: number; remaining: number;
    cancelLocked: boolean };
}

export interface LobbyRoomStateDependencies {
  nodeName(node: unknown): string | undefined;
  slots(room: RoomSnapshot, playerId: string): RoomSlot[];
  roadblockRunner(room: RoomSnapshot): string | undefined;
  gameplayMode(room: RoomSnapshot): string;
  decodeChat(text: string, emotions: Emotion[]): { text: string };
  wrapBubble(text: string): string[];
  drawBubbleLine(canvas: PaintContext, line: string, rect: RoomRect,
    options: Record<string, unknown>): void;
  nowMs(): number;
  roadblockDefaults: { noRunnerManualReset: boolean; limitMs: number };
  rpChannelNames: Record<string, string>;
  colors: { redTeam: string; blueTeam: string; ownChat: string;
    otherChat: string };
}

type NodeState = Record<string, unknown>;

function emotionState(host: LobbyRoomStateHost, name: string): NodeState | undefined {
  const disabled = host.busy || !host.connected ||
    host.room.phase !== "open" || host.chatSending;
  if (name === "roomEmotionToggle") return {
    label: tr("表情"), expanded: host.emotionWheelOpen, disabled,
    action: () => host.toggleEmotionWheel(),
  };
  if (name === "roomEmotionWheel") return {
    visible: host.emotionWheelOpen, pointerBlock: true,
  };
  if (!name.startsWith("roomEmotion/")) return undefined;
  const emotion = host.emotions[Number(name.slice(12))];
  return {
    visible: host.emotionWheelOpen && !!emotion,
    disabled,
    action: () => {
      if (emotion) {
        host.sendEmotion(emotion);
        host.closeEmotionWheel();
      }
    },
  };
}

function memberSlotState(host: LobbyRoomStateHost, name: string,
  disabled: boolean, isHost: boolean,
  dependencies: LobbyRoomStateDependencies): NodeState | undefined {
  if (/^rider\d+$/.test(name)) {
    const slot = dependencies.slots(host.room, host.playerId)[Number(name.slice(5))];
    return { hoverRegion: disabled ? undefined : name,
      hoverRegionSound: !disabled && !!slot && !slot.open };
  }
  const match = /^rider(\d+)\/(.+)$/.exec(name);
  if (!match) return undefined;

  const room = host.room;
  const slotIndex = Number(match[1]);
  const slot = dependencies.slots(room, host.playerId)[slotIndex];
  const member = slot?.member;
  const part = match[2]!;
  const hovered = !disabled && host.view?.hoveredRegionId === `rider${slotIndex}`;
  const own = member?.playerId === host.playerId;
  const roomHost = member?.playerId === room.hostId;
  const occupied = !!member || (room.mode === "individual" && !slot?.open);
  const runnerId = dependencies.roadblockRunner(room);
  const roadblockTeam = member && runnerId
    ? member.playerId === runnerId ? "red" : "blue" : undefined;
  const team = room.mode === "team" ? member?.team : null;

  if (part === "talkBalloon" || part === "talkBalloon/nametag") {
    const bubble = member && host.bubbles.get(member.playerId);
    if (!bubble || bubble.until <= dependencies.nowMs()) return { visible: false };
    if (part === "talkBalloon/nametag") return {
      visible: true, text: member!.name,
      textColor: team === 1 ? dependencies.colors.redTeam :
        dependencies.colors.blueTeam,
    };
    const translated = member!.playerId !== host.playerId ? translatedRoomChat(host, bubble.text) : undefined;
    const lines = dependencies.wrapBubble(translated ? `[AI] ${translated}` : bubble.text);
    return { visible: true,
      size: { width: 140, height: 70 + (lines.length - 1) * 19 },
      paint: (canvas: PaintContext, rect: RoomRect) => {
        lines.forEach((line, index) => dependencies.drawBubbleLine(canvas,
          line, { x: rect.x + 10, y: rect.y + 36 + index * 19,
            width: 120, height: 19 }, {
            family: "KartSim Multiplayer Windows", size: 14, kind: "label",
            color: "black", align: "left", verticalAlign: "top",
          }));
      },
    };
  }

  const roadblockBackground = /^roadBlockBackground\/(red|blue)(Hover)?$/.exec(part);
  if (roadblockBackground) return {
    visible: roadblockTeam === roadblockBackground[1] &&
      !!roadblockBackground[2] === hovered,
  };
  if (part.startsWith("roadBlockCover/")) return {
    visible: !!roadblockTeam && part.endsWith(roadblockTeam),
  };
  const teamBackground = /^teamBackground([12])(Hover)?$/.exec(part);
  if (teamBackground) return {
    visible: !!team && Number(teamBackground[1]) === team &&
      !!teamBackground[2] === hovered,
  };
  if (part.startsWith("teamCover")) return {
    visible: !!team && part.endsWith(String(team)),
  };

  const closeSlot = isHost && !member && slot?.open && !disabled ? {
    label: tr("关闭席位 {value}", { value: String(slot.slot + 1) }),
    action: () => host.actions.slot(slot.slot, true),
  } : {};
  switch (part) {
    case "btn_singleEmptySlot1_1": return {
      visible: !occupied && !hovered, silentHover: true, ...closeSlot,
    };
    case "btn_singleEmptySlot1_1Hover": return {
      visible: !occupied && hovered, silentHover: true, ...closeSlot,
    };
    case "btn_singleSlot1_1": return {
      visible: occupied && !team && !roadblockTeam && !hovered,
    };
    case "btn_singleSlot1_1Hover": return {
      visible: occupied && !team && !roadblockTeam && hovered,
    };
    case "singleCover": return { visible: !team && !roadblockTeam };
    case "runnerTag": return { visible: roadblockTeam === "red" };
    case "blockerTag": return { visible: roadblockTeam === "blue" };
    case "runnerHandicap": return {
      visible: roadblockTeam === "red" &&
        (room.phase === "open" ? dependencies.roadblockDefaults.noRunnerManualReset
          : room.race?.roadblock?.noRunnerManualReset === true),
    };
    case "preview": return { visible: !!member,
      paint: (canvas: PaintContext, rect: RoomRect) => {
        if (member) host.previews?.paint(member.playerId, canvas, rect,
          dependencies.nowMs());
      },
    };
    case "closed":
    case "closedHover": return {
      visible: !slot?.open && (part === "closedHover" ? hovered : !hovered),
      silentHover: true,
      disabled: disabled || !isHost || !!member ||
        !(room.mode === "team"
          ? (slot?.slot ?? NaN) % 4 < room.capacity / 2
          : (slot?.slot ?? NaN) < room.capacity),
      label: tr("开启席位 {value}", { value: String((slot?.slot ?? 0) + 1) }),
      action: slot && !member ? () => host.actions.slot(slot.slot, false) : undefined,
    };
    case "riderNameLabel": return { visible: !!member, text: member?.name ?? "" };
    // 50人乱斗: an open seat nobody takes races as AI.
    case "aiHint": return { visible: !member && !!slot?.open };
    case "developerTag": return { visible: member?.gm === true, label: tr("开发者"),
      paint: (canvas: PaintContext, rect: RoomRect) =>
        paintDeveloperBadge(canvas as CanvasRenderingContext2D, rect) };
    case "bossTag_me": return { visible: !!member && roomHost && own };
    case "bossTag_other": return { visible: !!member && roomHost && !own };
    case "ready": return { visible: !!member && member.ready && !roomHost && !member.changing };
    case "changing": return { visible: !!member && !!member.changing };
    case "myRiderTag": return { visible: !!member && own };
    case "kick": return { visible: !!member && isHost && !own,
      disabled, label: tr("移出 {value}", { value: String(member?.name) }),
      action: member ? () => host.actions.kick(member) : undefined };
    case "info": return { visible: !slot?.open || (!!member && isHost && !own),
      disabled: disabled || !member,
      label: member ? tr("将房主移交给 {value}", { value: String(member.name) }) : tr("空席位信息"),
      action: member ? () => host.actions.transfer(member) : undefined };
    default: return undefined;
  }
}

function roomDetailsState(host: LobbyRoomStateHost, name: string,
  dependencies: LobbyRoomStateDependencies): NodeState | undefined {
  const room = host.room;
  const mode = dependencies.gameplayMode(room);
  switch (name) {
    case "roomName": return { text: room.name };
    case "gameSpeed": return { text: room.speed === 4 ? tr("无限加速") : tr("标准速度") };
    case "gameType": return { text: mode === "rp"
      ? tr(dependencies.rpChannelNames[room.channelName ?? ""] ?? "")
      : mode === "roadblock" ? tr("挡人模式")
        : mode === "brave" ? tr("勇者组队竞速赛")
        : mode === "brawl" ? tr(BRAWL_LABEL)
        : mode === "ordinary" ? room.mode === "team" ? tr("组队竞速赛") : tr("个人竞速赛")
          : mode === "item" ? tr(itemModeLabel(room.mode === "team"))
          : tr("{team}{mode}{speed}", { team: room.mode === "team" ? tr("组队") : tr("个人"), mode: mode === "grip" ? tr("抓地") : tr("幽灵"), speed: room.speed === 4 ? tr("无限加速") : tr("赛") }) };
    case "changeRoomInfoNotPassword": return { visible: room.locked === false };
    case "changeRoomInfoPassword": return { visible: room.locked === true };
    // Web addition: the release says 等待中 whatever the phase, so a player who
    // joins a room during its race (allowed, they wait for the next one) sees
    // 等待中 beside controls that stay disabled, as if the window had hung.
    case "sessionStateStr": return { text: host.connected
      ? host.busy ? tr("正在处理…")
        : room.phase === "finished" ? tr("比赛结算中，请稍候")
        : room.phase !== "open" ? tr("比赛进行中，请稍候")
        : room.autoStartAt !== undefined
          ? tr("自动开始倒数 {value}", { value: String(host.countdownState().remaining) })
          : room.kickVote
            ? tr("移出投票 {value}/{value2}", { value: String(room.kickVote.yesIds.length), value2: String(Math.floor(room.kickVote.eligibleIds.length / 2) + 1) })
            : mode === "brave" ? tr("至少4人，人数均等") : tr("等待中")
      : tr("连接已断开") };
    case "chat": return { lines: (room.chat ?? []).flatMap(line => {
      const text = dependencies.decodeChat(line.text, host.emotions).text;
      if (!text) return [];
      const color = line.playerId === host.playerId ? dependencies.colors.ownChat : dependencies.colors.otherChat;
      const translated = line.playerId !== host.playerId ? translatedRoomChat(host, text) : undefined;
      return [{ text: `${line.name}: ${text}`, color },
        ...(translated ? [{ text: `[AI] ${translated}`, color }] : [])];
    }) };
    case "트랙카드": return { paint: (canvas: PaintContext, rect: RoomRect) => {
      if (host.trackImage) canvas.drawImage(host.trackImage,
        rect.x, rect.y, rect.width, rect.height);
      if (host.trackReverseStamp) canvas.drawImage(host.trackReverseStamp,
        rect.x, rect.y, rect.width, rect.height);
    } };
    case "trackTheme": return { visible: !!host.trackIcon,
      paint: (canvas: PaintContext, rect: RoomRect) => {
        if (host.trackIcon) canvas.drawImage(host.trackIcon,
          rect.x, rect.y, rect.width, rect.height);
      } };
    case "roomTrackDifficulty": return {
      visible: host.trackDifficulty !== undefined,
    };
    case "roomTrackDifficulty/chars": return {
      text: Array.from({ length: 6 }, (_, index) =>
        index < (host.trackDifficulty ?? 0) ? "1" : "0").join(""),
    };
    case "roadBlockTime": return {
      visible: mode === "roadblock" && (room.phase === "open" || !!room.race?.roadblock),
      text: tr("限制时间：{value} 分钟", { value: String((room.phase === "open" ? dependencies.roadblockDefaults.limitMs :
        (room.race?.roadblock?.limitMs ?? 0)) / 60000) }),
    };
    case "out_trackName": return { visible: mode !== "roadblock", text: host.trackTitle };
    default: return undefined;
  }
}

function roomCommandState(host: LobbyRoomStateHost, name: string,
  disabled: boolean, isHost: boolean,
  dependencies: LobbyRoomStateDependencies): NodeState | undefined {
  const room = host.room;
  const member = room.members.find(candidate => candidate.playerId === host.playerId);
  switch (name) {
    case "채팅": return {
      label: tr("房间聊天，按回车激活；再按发送，空内容取消选中"),
      disabled: disabled || host.chatSending,
      input: { value: host.chatDraft, maxLength: 120, blurOnEmptyEnter: true,
        change: (value: string) => { host.chatDraft = value; },
        submit: () => { host.sendChat(); } },
    };
    case "goBackButton": return { disabled: host.busy,
      label: tr("返回大厅"), action: host.actions.leave };
    case "readyButtonCont": return { visible: room.mode === "individual" };
    case "teamReadyButtonCont": return { visible: room.mode === "team" };
    case "ready": return { visible: !isHost && !member?.ready,
      disabled: disabled || !!member?.changing, label: tr("准备"),
      onActivate: host.actions.onStartActivate,
      action: () => host.actions.ready(true) };
    case "cancel": return { visible: !isHost && !!member?.ready &&
      !host.countdownState().active, disabled, label: tr("取消准备"),
      action: () => host.actions.ready(false) };
    case "cancel_count": return { visible: !isHost && !!member?.ready &&
      host.countdownState().active,
      disabled: disabled || host.countdownState().cancelLocked,
      label: tr("取消准备"), action: () => host.actions.ready(false) };
    case "changeRoomInfo": return { visible: isHost,
      disabled: disabled || !isHost || !host.actions.settings,
      label: tr("房间设置"), action: host.actions.settings };
    case "start": return { visible: isHost && !host.countdownState().active,
      disabled: disabled || !host.actions.start || host.actions.canStart?.() === false,
      onActivate: host.actions.onStartActivate,
      label: host.actions.start ? tr("开始比赛") : tr("开始比赛（尚未接入）"),
      action: host.actions.start };
    case "start_count": return { visible: isHost && host.countdownState().active,
      disabled: disabled || !host.actions.start || host.actions.canStart?.() === false,
      onActivate: host.actions.onStartActivate,
      label: tr("开始比赛"), action: host.actions.start };
    case "autoCount": return { visible: host.countdownState().active,
      paint: (canvas: PaintContext, rect: RoomRect) =>
        host.countdown?.paint(canvas, rect, host.countdownState().elapsed) };
    case "teamChange": return { disabled: disabled || (!isHost && !!member?.ready),
      label: tr("选择队伍"), action: host.actions.team };
    case "카트": return { disabled: disabled ||
      (isHost && host.countdownLocked) || (!isHost && !!member?.ready) ||
      !host.actions.garage, label: tr("选择赛车"), action: host.actions.garage };
    case "트랙": {
      const mode = dependencies.gameplayMode(room);
      if (mode === "brave") return {
        disabled: true, label: tr("命运之桥（勇者模式）"),
      };
      if (mode === "roadblock") return {
        disabled: true, label: tr("全部随机（挡人模式限定24张）"),
      };
      if (mode === "lte") return {
        disabled: true, label: tr("全部随机（LTE模式限定3张）"),
      };
      return { disabled: disabled || host.countdownLocked || !isHost ||
        !host.actions.track,
      label: isHost ? tr("选择赛道") : tr("由房主选择赛道"), action: host.actions.track };
    }
    case "randomTeam": {
      // Not in the release: the header switch; members other than the host only see it.
      const enabled = room.randomTeam === true;
      const usable = isHost && !disabled && !!host.actions.randomTeam;
      const hovered = usable && host.view?.hoveredRegionId === "randomTeam";
      return { visible: room.mode === "team", hoverRegion: usable ? "randomTeam" : undefined,
        disabled: !usable, checked: enabled,
        label: tr("队伍随机分配 {value}", { value: String(enabled ? "ON" : "OFF") }),
        action: usable ? () => host.actions.randomTeam?.(!enabled) : undefined,
        paint: (canvas: PaintContext, rect: RoomRect) => paintRandomTeamToggle(
          canvas as CanvasRenderingContext2D, rect, { enabled, hovered, disabled: !isHost || disabled }) };
    }
    default: return undefined;
  }
}

export function lobbyRoomNodeState(host: LobbyRoomStateHost, node: unknown,
  dependencies: LobbyRoomStateDependencies): NodeState {
  const name = dependencies.nodeName(node) ?? "";
  const emotion = emotionState(host, name);
  if (emotion) return emotion;
  const isHost = host.room.hostId === host.playerId;
  const disabled = host.busy || !host.connected || host.room.phase !== "open";
  return memberSlotState(host, name, disabled, isHost, dependencies) ??
    roomDetailsState(host, name, dependencies) ??
    roomCommandState(host, name, disabled, isHost, dependencies) ?? {};
}
