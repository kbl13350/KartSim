<div align="center">

# KartSim

**[English](#english) · [中文](#中文) · [한국어](#한국어)**

<a href="https://t.me/+lWZjfJ3tg6MyNTBl"><img alt="Telegram group" src="https://img.shields.io/badge/Telegram-Join%20the%20group-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"></a>

### 💬 TG 交流群 · Telegram group · 텔레그램 커뮤니티<br>👉 <https://t.me/+lWZjfJ3tg6MyNTBl> 👈

</div>

> [!IMPORTANT]
> **Join our Telegram group:** <https://t.me/+lWZjfJ3tg6MyNTBl>. Ask questions, report bugs, share ideas and follow updates.<br>
> **加入 TG 交流群：** <https://t.me/+lWZjfJ3tg6MyNTBl>，提问、反馈问题、交流想法、获取更新。<br>
> **텔레그램 커뮤니티 참여:** <https://t.me/+lWZjfJ3tg6MyNTBl>. 질문, 버그 제보, 아이디어 공유, 업데이트 소식을 확인하세요.

---

## English

KartSim is a browser kart racing game. It is a rebuild of a web kart racing release (front end v39.11, resource version p3553). The repository has two parts. **`client/`** is a TypeScript client split into modules by feature. **`server-go/`** is a Go backend with accounts, an in-game economy, multiplayer rooms and races, and an admin console. The game's original resources are in `mirror/`.

Implemented: registration and login; levels and three currencies; shop and inventory; garage; multiplayer lobby, rooms and races, including the grip, ghost, blocking, giant, RP, LTE and item modes; time attack; My Room; clubs; license tests; treasure draws; quests; reward box; chat; and the admin console.

### What is open source

| Directory | What it is |
| --- | --- |
| [`client/`](client/README.md) | **Front-end source.** TypeScript + Vite browser client, split by feature: driving, physics, world, vehicles, UI, time attack, multiplayer, shop, My Room, club and so on. It also holds tests and the tools that export game data for the server. |
| [`server-go/`](server-go/README.md) | **Back-end source.** `kart-data` handles accounts, economy, profiles, history, the admin console and server lists, and is the only process that talks to MySQL and Redis. `kart-game` runs rooms and races, with players connected over WebSocket or WebRTC. `kart-migrate-sqlite` moves old SQLite data. Also here: the admin console source (`admin-ui/`, Vue 3 + Element Plus), tests, and Docker deployment files. |
| `mirror/` | **Resources.** The original release's static files plus the 1,695 game containers of resource version p3553 (`mirror/p3553`, about 3.49 GiB, stored with Git LFS). The client serves this directory as its static resource folder. Copyright in these resources belongs to their original owners. |
| [`server/`](server/README.md) | The earlier Java (Spring Boot) server, kept for reference only. It was written from the protocol the browser exposes; it is not decompiled. |
| Root scripts and docs | `run-full-local.sh`, `run-lan.sh`, `run-local.sh`, the end-to-end checks `server-smoke.mjs` and `server-special-smoke.mjs`, the resource downloader `download_resources.py`, and the protocol notes [`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md). |

#### Directory guide

```text
KartSim/
├── client/                  Front-end source (TypeScript + Vite)
│   ├── src/                 Game modules by feature (driving, physics, world, multiplayer, shop, myroom, club, ui …)
│   │   └── generated/       Compatibility modules generated from the original release bundle (being replaced step by step)
│   ├── tests/               Client tests
│   └── tools/               Build helpers and data export tools (economy, career, item race, license, lottery, club …)
├── server-go/               Back-end source (Go)
│   ├── cmd/                 kart-data, kart-game, kart-migrate-sqlite
│   ├── internal/data/       Data service: accounts, economy, store, admin API …
│   ├── internal/game/       Game node: lobby, rooms, races, item race, WebSocket/WebRTC …
│   ├── internal/shared/     Contract and helpers shared by both services
│   ├── admin-ui/            Admin console source (Vue 3 + Element Plus)
│   ├── test/                Smoke tests, cluster tests, item race bots
│   └── scripts/             MySQL init scripts, dev dependencies (Docker Compose)
├── mirror/                  Resources (original release files + p3553 game containers, Git LFS)
├── server/                  Legacy Java server (reference only)
├── run-full-local.sh        Build and start data service + game node(s) + client locally
├── run-lan.sh               Same, served over HTTPS to other devices on the LAN
├── run-local.sh             Serve the original release mirror as is
└── SERVER_PROTOCOL.md       Original client protocol and the local extensions
```

### What is not open source

| Not published | What it is |
| --- | --- |
| `recovered/` | Readable code reconstructed from the original release bundle: formatted code, heuristic de-obfuscation output, analysis notes, a symbol index, and about 11,000 XML/BML configuration files decoded from the resource packs. |
| `apk_analysis/` | Unpacked and decompiled Android APK of the original game: decompiler output, IL2CPP metadata, and exported textures, icons and models. |
| `mirror/assets/*.decompiled/` | Decompiled output of the original audio decoder WebAssembly (`.wat`, wasm2c C code). The original `.wasm` itself stays in `mirror/`. |

These directories stay in the maintainers' local copies only. They are listed in `.gitignore` and are no longer uploaded.

#### Why they are not open source

1. **Copyright.** They are decompiled or reconstructed from someone else's software. They belong to the original rights holders, so we do not publish them as our source code.
2. **Not needed to build or run.** The client builds from `client/` and `mirror/`, and the server builds from `server-go/`. These directories were only research material used while rebuilding the game.
3. **Size and noise.** About 17,000 files and roughly 400 MB of intermediate analysis output. Leaving them out keeps the repository focused on code that can be maintained.

What this means in practice:

- `client/src/generated/` still contains compatibility modules generated from the original release bundle. They are needed at runtime and are being replaced by hand-written modules. Regenerating them (`npm run generate`) needs the unpublished `recovered/`.
- Some client tests compare behaviour with the original release, and some data export tools read `recovered/`. Those only run in the maintainers' local copies. `npm run typecheck`, `npm run build` and the Go tests do not need it.

### Quick start

Requirements: Git LFS, Node.js 22+, Go 1.26+, MySQL 8.4 and Redis 7.

```sh
git lfs install
git lfs pull                                              # game resources in mirror/p3553
mysql -h127.0.0.1 -P3306 -uroot -p < server-go/scripts/init-mysql.sql
# or: docker compose -f server-go/scripts/dev-deps.compose.yml up -d
./run-full-local.sh                                       # KART_GAME_NODES=2 starts two game nodes
```

Open the client at <http://127.0.0.1:8780/> (the script prints the exact address). The admin console is at <http://127.0.0.1:8787/multiplayer/admin>. Admins are set with `KART_ADMIN_USERNAMES`, for example `KART_ADMIN_USERNAMES=alice ./run-full-local.sh`.

- `./run-lan.sh` lets other devices on the LAN play over HTTPS.
- `./run-local.sh` serves the untouched original release at <http://127.0.0.1:8765/>.
- For production, use `server-go/docker-compose.yml`.
- More detail:
  - Environment variables, APIs, deployment and tests: [`server-go/README.md`](server-go/README.md)
  - Client development: [`client/README.md`](client/README.md)
  - Protocol: [`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md)

### Community

Telegram group: **<https://t.me/+lWZjfJ3tg6MyNTBl>**

---

## 中文

KartSim 是一款可以在浏览器里玩的卡丁车竞速游戏，是对一款网页版卡丁车发行版（前端 v39.11，资源版本 p3553）的重建，分为两部分：

- **`client/`**：按业务拆分模块的 TypeScript 客户端。
- **`server-go/`**：Go 后端，包含账号、经济系统、联机房间与比赛、管理后台。

游戏原有的资源放在 `mirror/`。

已实现的功能：

- 注册登录、等级与三种货币、商店与库存、车库。
- 联机大厅、房间与比赛，包括抓地、幽灵、挡人、巨人、RP、LTE、道具赛等模式。
- 计时赛、小屋、俱乐部、驾照考试、寻宝抽奖、任务、奖励箱、聊天。
- 管理后台。

### 开源了什么

| 目录 | 内容 |
| --- | --- |
| [`client/`](client/README.md) | **前端源码**。TypeScript + Vite 浏览器客户端，按驾驶、物理、世界、车辆、界面、计时赛、联机、商店、小屋、俱乐部等业务拆分；还包含测试，以及给服务端导出游戏数据的工具。 |
| [`server-go/`](server-go/README.md) | **后端源码**，包含：<br>• 数据服务 `kart-data`：账号、经济、档案、历史、管理后台、游戏服列表，是唯一访问 MySQL 与 Redis 的进程。<br>• 游戏节点 `kart-game`：房间与比赛，玩家经 WebSocket / WebRTC 连接。<br>• 旧数据迁移工具 `kart-migrate-sqlite`。<br>• 管理后台源码 `admin-ui/`（Vue 3 + Element Plus）、测试与 Docker 部署文件。 |
| `mirror/` | **资源**。原版发行文件，以及 p3553 资源版本的 1695 个游戏容器（`mirror/p3553`，约 3.49 GiB，用 Git LFS 存储）。客户端把它作为静态资源目录。资源版权归原权利人所有。 |
| [`server/`](server/README.md) | 早期的 Java（Spring Boot）服务端，仅作参考。它依据浏览器可见的协议编写，不是反编译结果。 |
| 根目录脚本与文档 | `run-full-local.sh`、`run-lan.sh`、`run-local.sh`，端到端检查 `server-smoke.mjs`、`server-special-smoke.mjs`，资源下载脚本 `download_resources.py`，协议说明 [`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md)。 |

#### 目录介绍

```text
KartSim/
├── client/                  前端源码（TypeScript + Vite）
│   ├── src/                 按业务划分的游戏模块（driving、physics、world、multiplayer、shop、myroom、club、ui …）
│   │   └── generated/       由原版发行包生成的兼容模块（正在逐步替换）
│   ├── tests/               客户端测试
│   └── tools/               构建辅助与数据导出工具（经济、生涯、道具赛、驾照、抽奖、俱乐部 …）
├── server-go/               后端源码（Go）
│   ├── cmd/                 kart-data、kart-game、kart-migrate-sqlite
│   ├── internal/data/       数据服务：账号、经济、存储、管理接口 …
│   ├── internal/game/       游戏节点：大厅、房间、比赛、道具赛、WebSocket/WebRTC …
│   ├── internal/shared/     两个服务共用的协议约定与工具
│   ├── admin-ui/            管理后台源码（Vue 3 + Element Plus）
│   ├── test/                冒烟测试、集群测试、道具赛机器人
│   └── scripts/             MySQL 初始化脚本、开发依赖（Docker Compose）
├── mirror/                  资源（原版发行文件 + p3553 游戏容器，Git LFS）
├── server/                  早期 Java 服务端（仅作参考）
├── run-full-local.sh        本机构建并启动数据服务 + 游戏节点 + 客户端
├── run-lan.sh               同上，并以 HTTPS 提供给局域网设备
├── run-local.sh             原样运行原版发行镜像
└── SERVER_PROTOCOL.md       原版客户端协议与本地扩展
```

### 没有开源什么

| 未公开 | 内容 |
| --- | --- |
| `recovered/` | 从原版发行包还原的可读代码：排版代码、启发式反混淆输出、分析笔记、符号索引，以及从资源包解码出的约 1.1 万个 XML/BML 配置。 |
| `apk_analysis/` | 原版安卓 APK 的解包与反编译结果：反编译输出、IL2CPP 元数据，以及导出的贴图、图标、模型。 |
| `mirror/assets/*.decompiled/` | 原版音频解码 WebAssembly 的反编译结果（`.wat`、wasm2c 生成的 C 代码）。原始 `.wasm` 仍在 `mirror/` 中。 |

这些目录只保留在维护者本地，已写入 `.gitignore`，之后不再上传。

#### 为什么不开源

1. **版权**：它们是对他人软件的反编译或还原，权利属于原权利人，我们不把它们当作自己的源码发布。
2. **构建和运行都不需要**：客户端由 `client/` 和 `mirror/` 构建，服务端由 `server-go/` 构建。这些目录只是重建游戏过程中的研究材料。
3. **体积与噪音**：约 1.7 万个文件、约 400 MB 的分析中间产物。去掉它们，仓库只保留可以维护的代码。

具体影响：

- `client/src/generated/` 仍有由原版发行包生成的兼容模块。运行时需要它们，正在逐步替换为手写模块。重新生成（`npm run generate`）需要未公开的 `recovered/`。
- 部分客户端测试要和原版逐项对照行为，部分数据导出工具会读取 `recovered/`，它们只能在维护者本地运行。`npm run typecheck`、`npm run build` 和 Go 测试不依赖它。

### 快速开始

需要 Git LFS、Node.js 22+、Go 1.26+、MySQL 8.4 和 Redis 7。

```sh
git lfs install
git lfs pull                                              # 拉取 mirror/p3553 游戏资源
mysql -h127.0.0.1 -P3306 -uroot -p < server-go/scripts/init-mysql.sql
# 或者：docker compose -f server-go/scripts/dev-deps.compose.yml up -d
./run-full-local.sh                                       # KART_GAME_NODES=2 可同时启动两个游戏节点
```

客户端地址是 <http://127.0.0.1:8780/>（以脚本打印的为准），管理后台是 <http://127.0.0.1:8787/multiplayer/admin>。管理员用 `KART_ADMIN_USERNAMES` 指定，例如 `KART_ADMIN_USERNAMES=alice ./run-full-local.sh`。

- `./run-lan.sh`：让局域网设备通过 HTTPS 访问。
- `./run-local.sh`：在 <http://127.0.0.1:8765/> 原样运行原版发行镜像。
- 生产部署：使用 `server-go/docker-compose.yml`。
- 详细说明：
  - 环境变量、接口、部署与测试：[`server-go/README.md`](server-go/README.md)
  - 客户端开发：[`client/README.md`](client/README.md)
  - 协议：[`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md)

### 交流群

TG 交流群：**<https://t.me/+lWZjfJ3tg6MyNTBl>**

---

## 한국어

KartSim은 브라우저에서 즐기는 카트 레이싱 게임입니다. 웹 카트 레이싱 배포판(프런트엔드 v39.11, 리소스 버전 p3553)을 재구축한 프로젝트이며, 두 부분으로 나뉩니다.

- **`client/`**: 기능별 모듈로 나눈 TypeScript 클라이언트
- **`server-go/`**: 계정, 게임 내 경제, 멀티플레이 방과 레이스, 관리자 콘솔을 갖춘 Go 백엔드

게임 원본 리소스는 `mirror/`에 있습니다.

구현된 기능:

- 회원가입과 로그인, 레벨과 세 가지 재화, 상점과 인벤토리, 차고
- 멀티플레이 로비, 방과 레이스(그립, 고스트, 블로킹, 자이언트, RP, LTE, 아이템전 등 모드 포함)
- 타임어택, 마이룸, 클럽, 라이선스 시험, 보물찾기 뽑기, 퀘스트, 보상함, 채팅
- 관리자 콘솔

### 공개된 것

| 디렉터리 | 내용 |
| --- | --- |
| [`client/`](client/README.md) | **프런트엔드 소스.** TypeScript + Vite 브라우저 클라이언트입니다. 주행, 물리, 월드, 차량, UI, 타임어택, 멀티플레이, 상점, 마이룸, 클럽 등 기능별로 나뉘어 있습니다. 테스트와 서버용 게임 데이터 내보내기 도구도 들어 있습니다. |
| [`server-go/`](server-go/README.md) | **백엔드 소스.** 구성:<br>• `kart-data`: 계정, 경제, 프로필, 기록, 관리자 콘솔, 서버 목록 담당. MySQL과 Redis에 접근하는 유일한 프로세스입니다.<br>• `kart-game`: 방과 레이스 담당. 플레이어는 WebSocket/WebRTC로 접속합니다.<br>• `kart-migrate-sqlite`: 이전 SQLite 데이터 이전 도구<br>• 관리자 콘솔 소스 `admin-ui/`(Vue 3 + Element Plus), 테스트, Docker 배포 파일 |
| `mirror/` | **리소스.** 원본 배포판의 정적 파일과 리소스 버전 p3553의 게임 컨테이너 1,695개입니다(`mirror/p3553`, 약 3.49 GiB, Git LFS로 저장). 클라이언트가 정적 리소스 폴더로 사용합니다. 리소스의 저작권은 원저작권자에게 있습니다. |
| [`server/`](server/README.md) | 초기 Java(Spring Boot) 서버로, 참고용으로만 남겨 두었습니다. 브라우저에서 보이는 프로토콜을 바탕으로 작성했으며 디컴파일 결과물이 아닙니다. |
| 루트 스크립트와 문서 | `run-full-local.sh`, `run-lan.sh`, `run-local.sh`, 종단 간 점검 `server-smoke.mjs`·`server-special-smoke.mjs`, 리소스 다운로드 스크립트 `download_resources.py`, 프로토콜 설명 [`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md). |

#### 디렉터리 안내

```text
KartSim/
├── client/                  프런트엔드 소스(TypeScript + Vite)
│   ├── src/                 기능별 게임 모듈(driving, physics, world, multiplayer, shop, myroom, club, ui …)
│   │   └── generated/       원본 배포 번들에서 생성한 호환 모듈(단계적으로 교체 중)
│   ├── tests/               클라이언트 테스트
│   └── tools/               빌드 보조 및 데이터 내보내기 도구(경제, 커리어, 아이템전, 라이선스, 뽑기, 클럽 …)
├── server-go/               백엔드 소스(Go)
│   ├── cmd/                 kart-data, kart-game, kart-migrate-sqlite
│   ├── internal/data/       데이터 서비스: 계정, 경제, 저장소, 관리자 API …
│   ├── internal/game/       게임 노드: 로비, 방, 레이스, 아이템전, WebSocket/WebRTC …
│   ├── internal/shared/     두 서비스가 함께 쓰는 프로토콜 규약과 유틸리티
│   ├── admin-ui/            관리자 콘솔 소스(Vue 3 + Element Plus)
│   ├── test/                스모크 테스트, 클러스터 테스트, 아이템전 봇
│   └── scripts/             MySQL 초기화 스크립트, 개발용 의존 서비스(Docker Compose)
├── mirror/                  리소스(원본 배포 파일 + p3553 게임 컨테이너, Git LFS)
├── server/                  초기 Java 서버(참고용)
├── run-full-local.sh        데이터 서비스 + 게임 노드 + 클라이언트를 로컬에서 빌드·실행
├── run-lan.sh               위와 같으며, 같은 LAN의 다른 기기에 HTTPS로 제공
├── run-local.sh             원본 배포 미러를 그대로 실행
└── SERVER_PROTOCOL.md       원본 클라이언트 프로토콜과 로컬 확장 설명
```

### 공개하지 않은 것

| 비공개 | 내용 |
| --- | --- |
| `recovered/` | 원본 배포 번들에서 복원한 읽기용 코드입니다. 정리된 코드, 휴리스틱 난독화 해제 결과, 분석 노트, 심볼 색인, 리소스 팩에서 디코딩한 XML/BML 설정 파일 약 11,000개가 들어 있습니다. |
| `apk_analysis/` | 원작 안드로이드 APK의 압축 해제·디컴파일 결과입니다. 디컴파일러 출력, IL2CPP 메타데이터, 추출한 텍스처·아이콘·모델이 들어 있습니다. |
| `mirror/assets/*.decompiled/` | 원본 오디오 디코더 WebAssembly의 디컴파일 결과(`.wat`, wasm2c C 코드)입니다. 원본 `.wasm` 파일은 `mirror/`에 그대로 있습니다. |

이 디렉터리들은 관리자의 로컬 사본에만 보관됩니다. `.gitignore`에 등록되어 앞으로 업로드되지 않습니다.

#### 공개하지 않는 이유

1. **저작권.** 다른 사람의 소프트웨어를 디컴파일하거나 복원한 결과물입니다. 권리는 원저작권자에게 있으므로 우리 소스 코드로 공개하지 않습니다.
2. **빌드와 실행에 필요 없음.** 클라이언트는 `client/`와 `mirror/`로, 서버는 `server-go/`로 빌드됩니다. 이 디렉터리들은 게임을 재구축하는 과정에서 쓴 연구 자료일 뿐입니다.
3. **용량과 잡음.** 파일 약 17,000개, 약 400 MB에 이르는 분석 중간 산출물입니다. 이를 빼야 저장소에 유지보수할 수 있는 코드만 남습니다.

실제 영향:

- `client/src/generated/`에는 원본 배포 번들에서 생성한 호환 모듈이 아직 남아 있습니다. 실행에 필요하며, 직접 작성한 모듈로 단계적으로 교체하고 있습니다. 다시 생성(`npm run generate`)하려면 비공개 `recovered/`가 필요합니다.
- 일부 클라이언트 테스트는 원본과 동작을 비교하고, 일부 데이터 내보내기 도구는 `recovered/`를 읽습니다. 이것들은 관리자 로컬 사본에서만 실행됩니다. `npm run typecheck`, `npm run build`, Go 테스트에는 필요하지 않습니다.

### 빠른 시작

필요한 것: Git LFS, Node.js 22+, Go 1.26+, MySQL 8.4, Redis 7.

```sh
git lfs install
git lfs pull                                              # mirror/p3553 게임 리소스 받기
mysql -h127.0.0.1 -P3306 -uroot -p < server-go/scripts/init-mysql.sql
# 또는: docker compose -f server-go/scripts/dev-deps.compose.yml up -d
./run-full-local.sh                                       # KART_GAME_NODES=2 이면 게임 노드 2개 실행
```

클라이언트 주소는 <http://127.0.0.1:8780/>(스크립트가 출력하는 주소 기준), 관리자 콘솔은 <http://127.0.0.1:8787/multiplayer/admin>입니다. 관리자는 `KART_ADMIN_USERNAMES`로 지정합니다. 예: `KART_ADMIN_USERNAMES=alice ./run-full-local.sh`.

- `./run-lan.sh`: 같은 LAN의 기기가 HTTPS로 접속할 수 있습니다.
- `./run-local.sh`: 원본 배포 미러를 <http://127.0.0.1:8765/>에서 그대로 실행합니다.
- 운영 배포: `server-go/docker-compose.yml`을 사용합니다.
- 자세한 내용:
  - 환경 변수, API, 배포, 테스트: [`server-go/README.md`](server-go/README.md)
  - 클라이언트 개발: [`client/README.md`](client/README.md)
  - 프로토콜: [`SERVER_PROTOCOL.md`](SERVER_PROTOCOL.md)

### 커뮤니티

텔레그램 그룹: **<https://t.me/+lWZjfJ3tg6MyNTBl>**
