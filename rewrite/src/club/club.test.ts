import assert from "node:assert/strict";
import test from "node:test";

import { ClubApi, clubErrorMessage, formatClubDate, formatLucci, gradeName, parseClubHouse,
  parseClubState } from "./club-api";

const clubBody = { id: 7, name: "跑跑测试部", intro: "欢迎", mark: 22, frame: 0, level: 2,
  facilities: [2, 1, 1, 1], master: "会长", members: 3, maxMembers: 100, cs: 120, csWeek: 30, budget: 100000,
  autoJoin: true, createdAt: Date.UTC(2026, 9, 9) };

test("club state, members and rules parse", () => {
  const state = parseClubState({ me: { clubId: 7, grade: 1 }, club: clubBody,
    members: [{ accountId: "a", nickname: "会长", grade: 1, joinedAt: 1, csWeek: 3, csTotal: 9, level: 60,
      glove: "x", online: true }],
    rules: { createLevel: 56, createLucci: 100000, nameMin: 2, nameMax: 10, introMax: 150, memberCaps: [100],
      budgetCaps: [1000000], donations: [10000, 30000], upgrades: [{ level: 2, cs: 500, lucci: 200000, members: 5 }],
      welfares: [{ slot: 0, level: 2, name: "福利", currency: "lucci", amount: 2000 }], nameChangeLucci: 1,
      markChangeLucci: 1, marks: [{ id: 22, level: 1, order: 26, basic: true }], frames: [{ id: 0, level: 1, order: 3 }] } });
  assert.equal(state.club?.facilities[0], 2);
  assert.equal(state.members[0]?.online, true);
  assert.equal(state.rules?.marks[0]?.basic, true);
  assert.equal(state.rules?.frames[0]?.basic, false);
  const outside = parseClubState({ me: { applied: { id: 9, name: "别的" }, cooldownUntil: 5 } });
  assert.equal(outside.club, undefined);
  assert.deepEqual(outside.me, { clubId: 0, grade: 0, cooldownUntil: 5, applied: { id: 9, name: "别的" } });
  assert.throws(() => parseClubState({ me: { clubId: "x" } }));
});

test("the house parses and the helpers word values", () => {
  const house = parseClubHouse({ club: clubBody, grade: 2, donations: [{ nickname: "甲", amount: 100000, createdAt: 1 }],
    topDonor: "甲", myDonations: 100000, donatedToday: true, welfareToday: [0] });
  assert.equal(house.donations[0]?.amount, 100000);
  assert.deepEqual(house.welfareToday, [0]);
  assert.equal(formatLucci(100000), "10万");
  assert.equal(formatLucci(12345), "12,345");
  assert.equal(gradeName(2), "俱乐部管理层");
  assert.match(formatClubDate(Date.UTC(2026, 9, 9, 12)), /^2026\.10\.(09|10)$/);
  assert.equal(clubErrorMessage("CLUB_DONATED_TODAY"), "每日限捐1次。");
  assert.match(clubErrorMessage("WHATEVER"), /WHATEVER/);
});

test("requests go to the club endpoints with their bodies", async () => {
  const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
  const applied: unknown[] = [];
  const api = new ClubApi({
    async requestJson(path: string, init?: RequestInit) {
      calls.push({ path, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (path.startsWith("/api/club/list")) return { clubs: [clubBody], total: 1, page: 0, perPage: 15 };
      if (path === "/api/club/donate") return { house: { club: clubBody, grade: 1 },
        account: { account: { username: "u", nickname: "n" }, progress: { level: 3 }, wallet: { coupon: 0, lucci: 1, koin: 0 } } };
      return { me: { clubId: 7, grade: 1 }, club: clubBody, members: [], joined: true };
    },
    applySummary(summary) { applied.push(summary); },
  });
  const list = await api.list({ name: "跑跑", page: 0 });
  assert.equal(list.clubs[0]?.name, "跑跑测试部");
  assert.equal(calls[0]?.path, `/api/club/list?page=0&name=${encodeURIComponent("跑跑")}`);
  const apply = await api.apply(7);
  assert.equal(apply.joined, true);
  assert.deepEqual(calls[1], { path: "/api/club/apply", method: "POST", body: { clubId: 7 } });
  await api.member("b", { kick: true });
  assert.deepEqual(calls[2]?.body, { accountId: "b", kick: true });
  await api.donate(100000);
  assert.equal(applied.length, 1);
});
