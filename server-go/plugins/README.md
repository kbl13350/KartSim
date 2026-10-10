# 游戏节点插件

这里放 kart-game 在启动时加载的编译好的插件。目前只有一个：

| 文件 | 说明 |
| --- | --- |
| `anticheat.wasm` | 服务端反作弊插件（WebAssembly，WASI reactor，ABI 1）。宿主侧的说明见 [`../ANTICHEAT.md`](../ANTICHEAT.md) |

- 插件源码不公开，不进入仓库。本目录下的子目录都在 `.gitignore` 和 `.dockerignore` 里，只有这一层的文件会被提交、打进镜像。
- kart-game 会自动找到这里的插件：`server-go/bin/kart-game` 会查找上一级的 `plugins/`。`run-full-local.sh` 会把它复制到运行目录，Docker 镜像会把它放到 `/usr/local/lib/kart/plugins/`。
- 要换插件，覆盖 `anticheat.wasm` 后重启游戏节点即可，不需要重新编译服务端；也可以用 `KART_ANTICHEAT_PLUGIN=<路径>` 指定别处的文件。`KART_ANTICHEAT_PLUGIN=off` 表示不加载插件。
- 启动日志里的 `anti-cheat plugin loaded` 会打印加载的路径、插件名和版本。
