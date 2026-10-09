import assert from "node:assert/strict";
import test from "node:test";

import { MessengerConnection, parseChatLine, type ChatJoined, type ChatLine,
  type MessengerSocket } from "../messenger/messenger-connection";
import { MessengerStore } from "../messenger/messenger-store";
import { MenusApi, menuErrorMessage, parseQuest, parseRewardBoxEntry, parseRiderCard } from "./menus-api";
import { questLists, questProgressText } from "./quest-screen";
import { claimedMessage, formatBoxTime, rewardDescription, rewardTitle, storageLeft } from "./reward-box-screen";

const DAY = 24 * 60 * 60 * 1000;

const entry = (fields: Record<string, unknown>) => parseRewardBoxEntry({ id: 1, source: "quest", message: "任务：x",
  name: "幸运车胎", category: 24, itemId: 862, count: 1, days: 0, createdAt: 0, expiresAt: 30 * DAY, ...fields });

test("reward box entries parse and read like the release cards", () => {
  const tire = entry({});
  assert.equal(tire.currency, undefined);
  assert.equal(rewardTitle(tire), "幸运车胎");
  assert.equal(rewardTitle(entry({ count: 3 })), "幸运车胎 ×3");
  const lucci = entry({ name: "1,000金币", category: 0, itemId: 0, count: 1000, currency: "lucci" });
  assert.equal(rewardTitle(lucci), "1,000金币");
  assert.equal(rewardTitle(entry({ name: "点券", count: 500, currency: "coupon" })), "500点券");
  assert.equal(rewardDescription(lucci), "1,000 金币|领取后直接存入账户。");
  assert.equal(rewardDescription(entry({ days: 7 })), "数量：1个|使用期限：7天");
  assert.equal(rewardDescription(tire), "数量：1个|使用期限：永久");
  assert.equal(storageLeft(30 * DAY, 0), "30天");
  assert.equal(storageLeft(DAY + 5, 0), "1天");
  assert.equal(storageLeft(2 * 60 * 60 * 1000 + 1, 0), "3小时");
  assert.equal(storageLeft(0, 5), "1小时");
  // Beijing time, the release dateTimeFormat.
  assert.equal(formatBoxTime(Date.UTC(2026, 9, 9, 16, 5)), "2026-10-10 0:05");
  assert.equal(claimedMessage(["500点券"]), "已成功领取：500点券。|（领取的道具可以在我的道具中确认。）");
  assert.match(claimedMessage(["[活动]光明骑士幸运宝石", "幸运车胎", "1,000金币"]), /^已成功领取：.+等3个道具。/);
  assert.throws(() => parseRewardBoxEntry({ id: "x" }));
});

const questBody = { id: 9006, reset: "daily", kind: 3, target: 100, channels: ["speedIndiCombine"], title: "累计行驶距离",
  desc: "x", mission: "多人游戏累计完成10KM", rewards: [{ name: "3酷币", count: 3, currency: "koin" },
    { name: "徽章", count: 1, emblem: 8872 }], value: 34, periodStart: 1, periodEnd: 2 };

test("quests parse, split into 进行中 / 完成 and word their progress", () => {
  const distance = parseQuest(questBody);
  assert.equal(distance.rewards[0]?.currency, "koin");
  assert.equal(distance.rewards[1]?.emblem, 8872);
  assert.equal(distance.locked, false);
  const strings = new Map([["missionTextDefault", "目前 %d回 / 目标 %d回"],
    ["missionTextDistance", "目前 %.1fkm / 目标 %.1fkm"]]);
  assert.equal(questProgressText(distance, strings), "目前 3.4km / 目标 10.0km");
  const drive = parseQuest({ ...questBody, id: 9001, kind: 1, target: 3, value: 2 });
  assert.equal(questProgressText(drive, new Map()), "目前 2回 / 目标 3回");
  const done = parseQuest({ ...questBody, id: 9002, completedAt: 5 });
  const locked = parseQuest({ ...questBody, id: 9202, reset: "none", pre: 9201, locked: true });
  const lists = questLists([distance, done, locked]);
  assert.deepEqual(lists.doing.map(quest => quest.id), [9006, 9202]);
  assert.deepEqual(lists.done.map(quest => quest.id), [9002]);
  assert.throws(() => parseQuest({ ...questBody, kind: "x" }));
});

test("the rider card parses its club and statistics", () => {
  const card = parseRiderCard({ nickname: "甲", progress: { level: 60, glove: "g", license: 5, proUntil: 0 },
    createdAt: 9, stats: { races: 10, wins: 3, podiums: 5, points: 77 }, mainEmblems: [8524, 0],
    presence: "ingame", self: false, club: { id: 7, name: "跑跑测试部", mark: 22, frame: 0, level: 2, grade: 1 } });
  assert.equal(card.level, 60);
  assert.equal(card.stats.wins, 3);
  assert.deepEqual(card.mainEmblems, [8524, 0]);
  assert.equal(card.club?.name, "跑跑测试部");
  const lone = parseRiderCard({ nickname: "乙", progress: {}, presence: "" });
  assert.equal(lone.presence, "offline");
  assert.equal(lone.level, 1);
  assert.equal(lone.club, undefined);
  assert.equal(menuErrorMessage("UNKNOWN_RIDER"), "找不到该车手。");
  assert.match(menuErrorMessage("SOMETHING"), /SOMETHING/);
});

test("the menus API calls the data service paths", async () => {
  const calls: Array<[string, string, unknown]> = [];
  const api = new MenusApi({
    async requestJson(path: string, init?: RequestInit) {
      calls.push([path, init?.method ?? "GET", init?.body ? JSON.parse(String(init.body)) : undefined]);
      if (path === "/api/reward-box/claim") return { claim: { claimed: [], items: [{ name: "幸运车胎", count: 1 }] },
        entries: [] };
      if (path === "/api/notices") return { notices: [{ title: "奖励箱", message: "m", kind: "rewardBox" }], rewardBox: 2 };
      if (path === "/api/quests") return { quests: [questBody], resetHour: 6 };
      if (path.startsWith("/api/riders/")) return { nickname: "甲 乙", progress: { level: 2 } };
      return { entries: [], days: 30, page: 8 };
    },
  });
  assert.equal((await api.rewardBox()).days, 30);
  assert.equal((await api.claimRewardBox([3, 4])).items[0]?.name, "幸运车胎");
  assert.equal((await api.notices()).rewardBox, 2);
  assert.equal((await api.quests()).quests[0]?.id, 9006);
  assert.equal((await api.rider("甲 乙")).nickname, "甲 乙");
  assert.deepEqual(calls.map(([path, method]) => `${method} ${path}`), ["GET /api/reward-box",
    "POST /api/reward-box/claim", "GET /api/notices", "GET /api/quests",
    `GET /api/riders/${encodeURIComponent("甲 乙")}`]);
  assert.deepEqual(calls[1]?.[2], { ids: [3, 4] });
});

class FakeSocket implements MessengerSocket {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  send(data: string): void { this.sent.push(JSON.parse(data)); }
  close(): void { this.readyState = 3; }
  receive(frame: Record<string, unknown>): void { this.onmessage?.({ data: JSON.stringify(frame) }); }
}

test("chat joins on welcome, delivers lines and answers sends", async () => {
  const socket = new FakeSocket();
  const store = new MessengerStore();
  const connection = new MessengerConnection({
    api: { state: async () => { throw new Error("offline"); } } as never, store, url: "ws://x",
    token: () => "t", viewing: () => false, openSocket: () => socket as never,
  });
  const joined: ChatJoined[] = [];
  const lines: ChatLine[] = [];
  connection.setChatListener({ joined: state => joined.push(state), line: line => lines.push(line) });
  connection.start();
  socket.readyState = 1;
  socket.onopen?.();
  socket.receive({ type: "welcome", accountId: "me", serverTime: 1, state: {
    me: { accountId: "me", nickname: "我", level: 3, glove: "" },
    settings: { blockFriendRequests: false, blockGameInvites: false, invisible: false },
    friends: [], incoming: [], outgoing: [], blocks: [], conversations: [], limits: { friends: 100 }, serverTime: 1 } });
  const join = socket.sent.find(frame => frame.type === "chat-join");
  assert.ok(join, "joins after welcome");
  const line = { id: 1, channel: "all", from: "甲", text: "你好", at: 5 };
  socket.receive({ type: "chat-joined", requestId: join!.requestId, all: [line], club: [], clubName: "部",
    hasClub: true });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(joined[0]?.all[0]?.text, "你好");
  assert.equal(joined[0]?.hasClub, true);
  socket.receive({ type: "chat", line: { ...line, id: 2, channel: "club" } });
  assert.equal(lines[0]?.channel, "club");
  const sending = connection.sendChat("all", "嗨");
  const sent = socket.sent.at(-1)!;
  assert.deepEqual([sent.type, sent.channel, sent.text], ["chat", "all", "嗨"]);
  socket.receive({ type: "chat-sent", requestId: sent.requestId, line: { ...line, id: 3, text: "嗨" } });
  assert.equal((await sending).id, 3);
  const flooding = connection.sendChat("all", "嗨");
  socket.receive({ type: "error", code: "CHAT_FLOOD", requestId: socket.sent.at(-1)!.requestId, mutedUntil: 9 });
  await assert.rejects(flooding, (error: Error & { code?: string }) => error.code === "CHAT_FLOOD");
  connection.setChatListener(undefined);
  assert.equal(socket.sent.at(-1)?.type, "chat-leave");
  connection.stop();
  assert.equal(parseChatLine({ id: 1, channel: "team", from: "a", text: "b", at: 1 }), undefined);
});
