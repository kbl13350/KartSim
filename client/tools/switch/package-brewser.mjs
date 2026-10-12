#!/usr/bin/env node
// Packages the Switch build (vite build --mode switch → build/switch-web) as a
// Brewser app folder: copy build/switch/<id>/ to sdmc:/switch/brewser/apps/<id>/.
// The folder carries every resource container, so the console reads them from
// the SD card and only logs in and plays online over the network (SWITCH.md).
//
//   node tools/switch/package-brewser.mjs --server http://192.168.1.10:8787
//     --server <origin>   data service the console connects to (can be changed in kartsim-switch.json)
//     --id <app id>       Brewser app id (default com.kartsim.client)
//     --out <dir>         output folder (default build/switch)
//     --mirror <dir>      mirror with p3553/ (default ../mirror, then the main checkout's)
//     --no-archives       leave out p3553/ (3.5 GB), e.g. to update only the program on the SD card
import { execFileSync } from "node:child_process";
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};
const flag = name => args.includes(`--${name}`);

const appId = option("id", "com.kartsim.client");
if (!/^com\.[a-z0-9]{3,32}\.[a-z0-9]{2,48}$/.test(appId)) {
  throw new Error(`Brewser app id must look like com.name.app (lowercase letters and digits): ${appId}`);
}
const server = option("server", "");
if (server) {
  const url = new URL(server);
  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`--server must be an http(s) origin without a path: ${server}`);
  }
}
const web = path.join(client, "build/switch-web");
const outRoot = path.resolve(client, option("out", "build/switch"));
const app = path.join(outRoot, appId);
const mirrorCandidates = [option("mirror", ""), path.join(client, "../mirror"),
  path.join(client, "../../KartSim/mirror")].filter(Boolean);
const mirror = mirrorCandidates.find(dir => existsSync(path.join(dir, "__p3553/resources")));
if (!mirror) throw new Error(`No mirror with __p3553/resources in ${mirrorCandidates.join(", ")}`);
const archives = mirrorCandidates.map(dir => path.join(dir, "p3553")).find(dir => existsSync(path.join(dir, "aaa.pk")));
if (!existsSync(path.join(web, "index.html"))) throw new Error("Run `vite build --mode switch` first (build/switch-web).");

/** APFS clones the 3.5 GB of archives instantly; other file systems copy. */
async function cloneFile(from, to) {
  try {
    execFileSync("cp", ["-c", from, to], { stdio: "ignore" });
  } catch {
    await copyFile(from, to);
  }
}

await rm(app, { recursive: true, force: true });
await mkdir(app, { recursive: true });
await cp(web, app, { recursive: true });
for (const name of ["index-mDCnV9Uo.css", "motor-vorbis-B0OpSz3w.wasm"]) {
  await copyFile(path.join(mirror, "assets", name), path.join(app, "assets", name));
}
for (const name of ["ui", "classic-hud", "__p3553"]) {
  await cp(path.join(mirror, name), path.join(app, name), { recursive: true });
}

let archiveBytes = 0;
let archiveCount = 0;
if (!flag("no-archives")) {
  if (!archives) throw new Error("No p3553/ archives found (pass --mirror, or --no-archives).");
  const manifest = JSON.parse(await readFile(path.join(mirror, "__p3553/resources"), "utf8"));
  await mkdir(path.join(app, "p3553"), { recursive: true });
  for (const file of manifest.files) {
    const from = path.join(archives, file.name);
    const size = (await stat(from)).size;
    if (size !== file.size) throw new Error(`${file.name}: ${size} bytes, the resource manifest says ${file.size}.`);
    if (size >= 4 * 1024 ** 3) throw new Error(`${file.name} is 4 GiB or more (FAT32 and Brewser's 32-bit offsets).`);
    await cloneFile(from, path.join(app, "p3553", file.name));
    archiveBytes += size;
    archiveCount++;
  }
}

// The banner Brewser shows in its Downloads tab.
const banner = path.join(app, "assets/appbanner.jpg");
try {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "80", "--resampleWidth", "640",
    path.join(mirror, "ui/loading/race-loading-1600.png"), "--out", banner], { stdio: "ignore" });
} catch {
  await copyFile(path.join(mirror, "ui/loading/race-loading-1600.png"), path.join(app, "assets/appbanner.png"));
}
const logo = existsSync(banner) ? "assets/appbanner.jpg" : "assets/appbanner.png";

// Brewser's shell actions are all moved to the inert HOME label: the game
// reads every button itself (switch-input.ts, the gamepad map in 设置), and
// HOME → close software quits. The software mouse is off (the game draws its
// own cursor, hidden while driving).
const shellActions = ["leftClick", "rightClick", "middleClick", "back", "forward", "reload", "home",
  "addressBar", "settings", "bookmark", "scrollUp", "scrollDown", "scrollLeft", "scrollRight", "exit"];
const manifest = {
  id: appId,
  name: "KartSim",
  version: JSON.parse(await readFile(path.join(client, "package.json"), "utf8")).version,
  description: "跑跑卡丁车网页版的 Switch 移植（私有，侧载）。资源在 SD 卡本地读取，需要连接 KartSim 服务器登录。",
  summary: "KartSim 卡丁车",
  logo,
  entry: "index.html",
  categories: ["Games"],
  compatibility: ["switch"],
  permissions: ["network", "local_network", "storage"],
  allowed_origins: [],
  developer: "KartSim",
  license: "Private",
  fullscreen: true,
  hideMouseDocked: true,
  hideMouseUndocked: true,
  freshProcessOnExit: true,
  buttonMapping: Object.fromEntries(shellActions.map(action => [action, "HOME"])),
};
await writeFile(path.join(app, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(app, "kartsim-switch.json"), `${JSON.stringify({ server: server || "" }, null, 2)}\n`);
await writeFile(path.join(outRoot, "README.txt"), `KartSim Switch 包（Brewser）

1. Switch 需要 Atmosphère 自制系统，并已安装 Brewser：
   sdmc:/switch/brewser.nro（https://github.com/natureglass/Brewser/releases）
2. 把本目录下的 ${appId} 整个文件夹复制到 SD 卡：
   sdmc:/switch/brewser/apps/${appId}/
3. 服务器地址在 ${appId}/kartsim-switch.json 的 "server"（例如 "http://192.168.1.10:8787"）。
   服务器的 KART_LAN_HOSTS 要包含 switch.brewser.io（Brewser 连接时带的 Origin）。
4. 按住 R 键启动任意游戏进入 hbmenu（完整内存模式，小程序模式内存不够），打开 Brewser，
   在 Downloads（下载）页启动 KartSim；也可以在应用详情里“Create shortcut”生成 sdmc:/switch/KartSim.nro。
5. 出错时屏幕顶部会显示红色提示，完整记录在 ${appId}/kartsim-log.txt。

按键：菜单里左摇杆/十字键移动光标，A 点击，B 返回，右摇杆滚动，+ 暂停/返回；
比赛中 ZR（或 A）油门，ZL 倒车，B 漂移，Y 道具/加速，X 换道具，R 第二道具，摇杆或十字键转向。
按键可以在游戏“设置”里改。退出游戏：HOME → 关闭软件。
`);

console.log(`Packaged ${appId} → ${app}`);
console.log(archiveCount ? `  ${archiveCount} resource containers, ${(archiveBytes / 1024 ** 3).toFixed(2)} GiB`
  : "  without resource containers (--no-archives)");
console.log(`  server: ${server || "(not set: edit kartsim-switch.json)"}`);
console.log(`Copy the folder to sdmc:/switch/brewser/apps/${appId}/ (see ${path.join(outRoot, "README.txt")}).`);
for (const entry of await readdir(app)) if (entry.startsWith(".")) await rm(path.join(app, entry), { recursive: true });
