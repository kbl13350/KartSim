import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { confirmLobbyMessage, createGameplayRoomDialog,
  createLobbyRoomDialog, createOrdinaryRoomDialog, noticeLobbyMessage } from
  "./lobby-dialog-facade";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class b1 {");
const end = release.indexOf("\nconst $l0 =", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Case = "confirm" | "notice" | "create" | "ordinary" |
  "ordinary-no-category" | "gameplay" | "gameplay-no-category" |
  "gameplay-invalid-channel" | "gameplay-invalid-mode";

async function observe(rewritten: boolean, scenario: Case) {
  const events: unknown[][] = [];
  const options = { cancel() { events.push(["cancel"]); } };
  const settings = { name: "房间", capacity: 8, password: "" };
  const modes: Record<string, { mode: string }> = {
    speedIndiCombine: { mode: "individual" },
    speedTeamCombine: { mode: "team" },
  };
  const validateGameplay = (gameplay: string) => {
    events.push(["validate", gameplay]);
    if (gameplay === "unknown") throw new Error("unknown gameplay");
  };
  const channelNames = (gameplay: string): Record<string, string> => {
    events.push(["channels", gameplay]);
    return { speedIndiCombine: "个人竞速" };
  };
  const form = async (...args: unknown[]) => {
    const [formOptions, mode, nickname, submit, channel, gameplay] = args;
    events.push(["form", formOptions === options, mode, nickname, channel,
      gameplay, args.length]);
    const selected = scenario.endsWith("no-category")
      ? undefined : "speedTeamCombine";
    (submit as (value: typeof settings, channel?: string) => void)(
      settings, selected);
    return "dialog";
  };
  const message = async (...args: unknown[]) => {
    const [messageOptions, title, body, confirm, labels, noticeOnly] = args;
    events.push(["message", messageOptions === options, title, body,
      confirm === options.cancel ? "cancel" : "confirm", labels,
      noticeOnly, args.length]);
    return "dialog";
  };
  const submit = (value: unknown) => events.push(["submit", value]);
  const onConfirm = () => events.push(["confirm"]);
  const Original = new Function("MI", "NT", "He",
    `${originalClass}\nreturn b1;`)(
      validateGameplay, channelNames, modes,
    ) as {
      confirm: (...args: unknown[]) => Promise<string>;
      notice: (...args: unknown[]) => Promise<string>;
      create: (...args: unknown[]) => Promise<string>;
      createOrdinary: (...args: unknown[]) => Promise<string>;
      createGameplay: (...args: unknown[]) => Promise<string>;
      messageBox: (...args: unknown[]) => Promise<string>;
      createForm: (...args: unknown[]) => Promise<string>;
    };
  Original.messageBox = message;
  Original.createForm = form;
  const dependencies = {
    mode(channel: string) { return modes[channel]!.mode; },
    validateGameplay,
    channelNames,
  };
  let result: string | undefined;
  let error: string | undefined;
  let synchronousThrow = false;
  try {
    let pending: Promise<string>;
    try {
      switch (scenario) {
        case "confirm":
          pending = rewritten
            ? confirmLobbyMessage(message, options, "标题", "内容", onConfirm,
              { yes: "确定" })
            : Original.confirm(options, "标题", "内容", onConfirm,
              { yes: "确定" });
          break;
        case "notice":
          pending = rewritten
            ? noticeLobbyMessage(message, options, "提醒", "说明")
            : Original.notice(options, "提醒", "说明");
          break;
        case "create":
          pending = rewritten
            ? createLobbyRoomDialog(form, options, "team", "车手", submit)
            : Original.create(options, "team", "车手", submit);
          break;
        case "ordinary":
        case "ordinary-no-category":
          pending = rewritten
            ? createOrdinaryRoomDialog(form, options, "speedIndiCombine",
              "车手", submit, dependencies)
            : Original.createOrdinary(options, "speedIndiCombine", "车手",
              submit);
          break;
        default: {
          const gameplay = scenario === "gameplay-invalid-mode"
            ? "unknown" : "roadblock";
          const channel = scenario === "gameplay-invalid-channel"
            ? "speedTeamCombine" : "speedIndiCombine";
          pending = rewritten
            ? createGameplayRoomDialog(form, options, gameplay, channel,
              "车手", submit, dependencies)
            : Original.createGameplay(options, gameplay, channel, "车手",
              submit);
        }
      }
    } catch (failure) {
      synchronousThrow = true;
      throw failure;
    }
    result = await pending;
  } catch (failure) {
    error = (failure as Error).message;
  }
  return { events, result, error, synchronousThrow };
}

test("lobby dialog entry points preserve release forwarding and category guards", async () => {
  for (const scenario of ["confirm", "notice", "create", "ordinary",
    "ordinary-no-category", "gameplay", "gameplay-no-category",
    "gameplay-invalid-channel", "gameplay-invalid-mode"] as const) {
    assert.deepEqual(await observe(true, scenario), await observe(false, scenario),
      scenario);
  }
});
