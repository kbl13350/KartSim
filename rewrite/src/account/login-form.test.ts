import assert from "node:assert/strict";
import test from "node:test";

import { loginWindowDefinition } from "../ui/game-login";
import type { Node } from "../ui/bml-kit";
import { startupLoginOptions } from "./login-gate";
import { LoginForm } from "./login-form";

function form(registration: "open" | "invite" | "closed" = "open") {
  const sent: Array<[string, Record<string, string>]> = [];
  let failure: Error | undefined;
  const value = new LoginForm(startupLoginOptions(registration), {
    requestAccount: async (action, fields) => {
      sent.push([action, fields]);
      if (failure) throw failure;
      return { token: "t", action };
    },
    formatError: error => `失败：${(error as Error).message}`,
  });
  return { form: value, sent, fail: (error?: Error) => { failure = error; } };
}

test("login checks the fields, sends them and reports failures", async () => {
  const { form: login, sent, fail } = form();
  assert.deepEqual(login.fields(), ["username", "password"]);
  assert.equal(await login.submit(), undefined);
  assert.equal(login.error, "请输入账号名。");
  login.set("username", "rider_1");
  login.set("password", "secret-pass");
  fail(new Error("密码错误"));
  assert.equal(await login.submit(), undefined);
  assert.equal(login.error, "失败：密码错误");
  fail();
  assert.deepEqual(await login.submit(), { token: "t", action: "login" });
  assert.deepEqual(sent.at(-1), ["login", { username: "rider_1", password: "secret-pass" }]);
  assert.equal(login.busy, false);
});

test("open registration: confirm password, the 有邀请码？ toggle, one register request", async () => {
  const { form: register, sent } = form("open");
  register.toggleMode();
  assert.deepEqual(register.fields(), ["username", "nickname", "password", "confirm"]);
  assert.equal(register.inviteToggleShown(), true);
  register.set("username", "rider_1");
  register.set("nickname", "车手");
  register.set("password", "secret-pass");
  register.set("confirm", "secret-pas");
  assert.equal(await register.submit(), undefined);
  assert.equal(register.error, "两次输入的密码不一致。");
  register.set("confirm", "secret-pass");
  register.revealInvite();
  assert.deepEqual(register.fields(), ["username", "nickname", "password", "confirm", "invite"]);
  assert.equal(register.inviteToggleShown(), false);
  assert.deepEqual(await register.submit(), { token: "t", action: "register" });
  // An empty optional code is left out; registering signs in (no second login).
  assert.deepEqual(sent, [["register", { username: "rider_1", nickname: "车手", password: "secret-pass" }]]);
  assert.equal(register.maxLength("nickname"), 16);
});

test("invite registration needs the code; closed registration has no register mode", async () => {
  const { form: invite } = form("invite");
  invite.toggleMode();
  assert.ok(invite.fields().includes("invite"));
  invite.set("username", "rider_1");
  invite.set("nickname", "车手");
  invite.set("password", "secret-pass");
  invite.set("confirm", "secret-pass");
  assert.equal(await invite.submit(), undefined);
  assert.equal(invite.error, "请输入邀请码。");
  const { form: closed } = form("closed");
  closed.toggleMode();
  assert.equal(closed.mode, "login");
  assert.equal(closed.canRegister, false);
});

test("the window: a DefaultEdit a field in a CaptionDialog, taller for registration", () => {
  const shape = (definition: Node) => {
    const edits: string[] = [];
    let height = 0;
    const names: string[] = [];
    const walk = (entry: Node) => {
      const attributes = Object.fromEntries(entry.attributes.map(item => [item.name, item.value]));
      if (attributes.name) names.push(attributes.name);
      if (entry.name === "Edit") edits.push(`${attributes.name}:${attributes.frame}`);
      if (attributes.name === "loginDialog") height = Number(attributes.windowRect!.split(" ")[3]);
      entry.children.forEach(walk);
    };
    walk(definition);
    return { edits, height, names };
  };
  const { form: open } = form("open");
  const login = shape(loginWindowDefinition(open, { heading: "账号登录", hint: "提示" }));
  assert.deepEqual(login.edits, ["username:DefaultEdit", "password:DefaultEdit"]);
  assert.ok(login.names.includes("modeButton") && !login.names.includes("inviteToggle"));
  open.toggleMode();
  const register = shape(loginWindowDefinition(open, { heading: "注册", hint: "提示" }));
  assert.deepEqual(register.edits.map(edit => edit.split(":")[0]), ["username", "nickname", "password", "confirm"]);
  assert.ok(register.names.includes("inviteToggle") && register.names.includes("rules"));
  assert.ok(register.height > login.height);
  const { form: closed } = form("closed");
  assert.ok(!shape(loginWindowDefinition(closed, { heading: "账号登录" })).names.includes("modeButton"));
});
