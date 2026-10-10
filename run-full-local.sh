#!/usr/bin/env bash
# 在本机构建并启动 Go 数据服务（kart-data）、KART_GAME_NODES 个游戏节点（kart-game）
# 和 Vite 前端；Ctrl-C 或任一进程退出时停止全部。run-lan.sh 复用本脚本。
#
# 常用环境变量（其余 KART_* 变量原样传给服务，见 server-go/README.md）：
#   KART_MYSQL_DSN        默认 kart:kart@tcp(127.0.0.1:3306)/kartsim?...（见 server-go/scripts/init-mysql.sql）
#   KART_REDIS_ADDR       默认 127.0.0.1:6379
#   KART_CLUSTER_SECRET   缺省时生成一次并保存在 server-go/data/cluster-secret（0600）
#   KART_GAME_NODES       游戏节点数，默认 1；端口从 KART_GAME_BASE_PORT（默认 8788）依次递增
#   KART_GAME_PUBLIC_ORIGIN  游戏节点对浏览器公布的 origin：缺省为 http://127.0.0.1:<端口>；
#                         可用 {port} 占位。same-origin 表示经页面同源代理（只能有一个节点），
#                         需要 run-lan.sh，或用 VITE_MULTIPLAYER_BACKEND_ORIGIN 指向把
#                         /multiplayer/ws 转给游戏节点的反向代理
#   KART_SKIP_DEPENDENCY_CHECK=1  跳过启动前的 MySQL/Redis 连通性检查
#   KART_VITE_PORT        前端（Vite）端口，默认 8780
#
# 账号经济（见 server-go/ECONOMY.md、server-go/README.md）：
#   KART_REGISTRATION     open（默认，开放注册）| invite（需要邀请码）| closed（关闭注册）
#   KART_ADMIN_USERNAMES  管理员用户名，逗号分隔（例如 KART_ADMIN_USERNAMES=alice）；
#                         管理页面在 <数据服务>/multiplayer/admin。名单中尚未注册的用户名在任何
#                         注册模式下都要凭邀请码注册：数据服务启动时在 [data] 日志里打印引导邀请码
#                         （“Bootstrap invitation … invite=…”），登录界面点“有邀请码？”填入
#   KART_BOOTSTRAP_INVITE 引导邀请码（可选）：未设置或已被使用时数据服务随机生成并写入日志
#   KART_ALLOW_GUESTS     默认 false（必须登录）；true 恢复游客票据（数据服务与游戏节点都会读取）
#   KART_TRUSTED_PROXIES  信任其 X-Forwarded-For 的代理，默认回环地址（本机的 Vite 代理与测试脚本）
#   KART_EXP_RATE / KART_LUCCI_RATE / KART_STARTING_LUCCI  奖励倍率与新账号初始金币（默认 1 / 1 / 10000；
#                         由数据服务读取，游戏节点经心跳响应得到倍率）
#
# 只用 bash 3.2 语法（macOS 自带的 /bin/bash）。
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
server_dir="$root/server-go"
state_dir="$server_dir/data"

fail() {
  printf '错误：%s\n' "$1" >&2
  shift
  for line in ${1+"$@"}; do printf '  %s\n' "$line" >&2; done
  exit 1
}

# ---------------------------------------------------------------- 配置 --------

data_addr=${KART_DATA_ADDR:-${SERVER_ADDRESS:-127.0.0.1}}
data_port=${KART_DATA_PORT:-${KART_SERVER_PORT:-8787}}
internal_listen=${KART_INTERNAL_LISTEN:-127.0.0.1:8790}
game_addr=${KART_GAME_ADDR:-${SERVER_ADDRESS:-127.0.0.1}}
game_nodes=${KART_GAME_NODES:-1}
game_base_port=${KART_GAME_BASE_PORT:-8788}
game_public_origin=${KART_GAME_PUBLIC_ORIGIN:-}
vite_port=${KART_VITE_PORT:-8780}
mysql_dsn=${KART_MYSQL_DSN:-kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci}
redis_addr=${KART_REDIS_ADDR:-127.0.0.1:6379}
registration=$(printf '%s' "${KART_REGISTRATION:-open}" | tr '[:upper:]' '[:lower:]')
admin_usernames=${KART_ADMIN_USERNAMES:-}

internal_host=${internal_listen%:*}
internal_port=${internal_listen##*:}

is_port() { [[ $1 =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }
is_port "$data_port" || fail "KART_DATA_PORT 不是有效端口：$data_port"
is_port "$internal_port" || fail "KART_INTERNAL_LISTEN 应为 主机:端口，当前为：$internal_listen"
is_port "$game_base_port" || fail "KART_GAME_BASE_PORT 不是有效端口：$game_base_port"
is_port "$vite_port" || fail "KART_VITE_PORT 不是有效端口：$vite_port"
[[ $game_nodes =~ ^[0-9]+$ ]] && [ "$game_nodes" -ge 1 ] && [ "$game_nodes" -le 20 ] ||
  fail "KART_GAME_NODES 应为 1–20 的整数，当前为：$game_nodes"
case $registration in
  open | invite | closed) ;;
  *) fail "KART_REGISTRATION 只能是 open、invite 或 closed，当前为：$registration" \
    "open：开放注册（默认）；invite：凭管理员生成的邀请码注册；closed：关闭注册" ;;
esac
# 管理员用户名与注册规则相同：3–24 位字母、数字、下划线，逗号分隔（两侧空白忽略）。
if [ -n "$admin_usernames" ]; then
  IFS=, read -r -a admin_list <<<"$admin_usernames"
  for name in ${admin_list[@]+"${admin_list[@]}"}; do
    name=${name#"${name%%[![:space:]]*}"}
    name=${name%"${name##*[![:space:]]}"}
    [ -z "$name" ] || [[ $name =~ ^[A-Za-z0-9_]{3,24}$ ]] ||
      fail "KART_ADMIN_USERNAMES 中的“$name”不是有效用户名（3–24 位字母、数字、下划线，逗号分隔）"
  done
fi
case $game_base_port in
  "$data_port" | "$internal_port" | "$vite_port")
    fail "KART_GAME_BASE_PORT=$game_base_port 与数据服务或前端端口冲突" ;;
esac
if [ "$game_nodes" -gt 1 ] && [ -n "$game_public_origin" ] &&
  [[ $game_public_origin != *"{port}"* ]]; then
  fail "多个游戏节点不能共用 KART_GAME_PUBLIC_ORIGIN=$game_public_origin" \
    "same-origin 只能用于一个节点；多个节点请用 {port} 占位，例如 https://game.example.com:{port}"
fi
# same-origin 节点在列表中的 origin 为 null，浏览器会向“数据服务 origin”/multiplayer/ws 发起
# WebSocket；数据服务没有这个路由，只有 run-lan.sh 的 Vite 代理或外部反向代理能转给游戏节点。
if [ "$game_public_origin" = same-origin ] && [ "${VITE_MULTIPLAYER_SAME_ORIGIN:-}" != 1 ] &&
  [ -z "${VITE_MULTIPLAYER_BACKEND_ORIGIN:-}" ]; then
  fail "KART_GAME_PUBLIC_ORIGIN=same-origin 需要同源代理，否则浏览器会把 WebSocket 连到数据服务而无法进入大厅。" \
    "局域网请直接运行 ./run-lan.sh（Vite 把 /multiplayer/ws 代理给游戏节点）；" \
    "或设置 VITE_MULTIPLAYER_BACKEND_ORIGIN 为把 /multiplayer/ws 转给游戏节点、其余转给数据服务的反向代理 origin。"
fi

# 游戏节点端口从基准端口递增，跳过数据服务、内部 API 和 Vite 占用的端口。
game_ports=()
port=$game_base_port
while [ "${#game_ports[@]}" -lt "$game_nodes" ]; do
  case $port in
    "$data_port" | "$internal_port" | "$vite_port") ;;
    *) game_ports+=("$port") ;;
  esac
  port=$((port + 1))
done

# 监听 0.0.0.0 等通配地址时，本机探测改用回环地址。
probe_host() {
  case $1 in
    "" | 0.0.0.0 | "::" | "[::]" | localhost) echo 127.0.0.1 ;;
    *) echo "$1" ;;
  esac
}
data_url="http://$(probe_host "$data_addr"):$data_port"
internal_url=${KART_DATA_INTERNAL_URL:-http://$(probe_host "$internal_host"):$internal_port}
game_probe=$(probe_host "$game_addr")

game_origin_for() {
  case $game_public_origin in
    "") echo "http://127.0.0.1:$1" ;;
    *"{port}"*) echo "${game_public_origin//\{port\}/$1}" ;;
    *) echo "$game_public_origin" ;;
  esac
}

# --------------------------------------------------------- 端口与依赖检查 --------

# tcp_open HOST PORT：3 秒内能建立 TCP 连接则成功（不依赖 nc）。
tcp_open() {
  local host=$1 port=$2 ticks=0 pid
  (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$ticks" -ge 30 ]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 1
    fi
    sleep 0.1
    ticks=$((ticks + 1))
  done
  wait "$pid"
}

for port in "$data_port" "$internal_port" "${game_ports[@]}" "$vite_port"; do
  if tcp_open 127.0.0.1 "$port"; then
    fail "端口 $port 已被占用（可能已有 kart-data、kart-game、旧 Java 服务或 Vite 在运行），请先停止它。" \
      "查看占用者：lsof -nP -iTCP:$port -sTCP:LISTEN"
  fi
done

# split_host_port ADDR DEFAULT_PORT：输出 "主机 端口"，支持 [IPv6]:端口。
split_host_port() {
  local addr=$1 host port
  if [[ $addr =~ ^\[([^]]*)\](:([0-9]+))?$ ]]; then
    host=${BASH_REMATCH[1]}
    port=${BASH_REMATCH[3]}
  elif [[ $addr == *:* ]]; then
    host=${addr%:*}
    port=${addr##*:}
  else
    host=$addr
    port=
  fi
  echo "${host:-127.0.0.1} ${port:-$2}"
}

# redact_dsn DSN：把 go-sql-driver DSN 中的密码换成 ***，供错误信息使用。与驱动的解析一致：
# 凭据在最后一个 / 之前的最后一个 @ 之前，用户名到第一个 : 为止（密码本身可以含 @ 和 :）。
redact_dsn() {
  local dsn=$1 head tail= cred
  head=$dsn
  if [[ $dsn == */* ]]; then
    head=${dsn%/*}
    tail=/${dsn##*/}
  fi
  if [[ $head == *@* ]]; then
    cred=${head%@*}
    [[ $cred == *:* ]] && cred="${cred%%:*}:***"
    head="$cred@${head##*@}"
  fi
  printf '%s%s' "$head" "$tail"
}

check_mysql() {
  # go-sql-driver DSN：[用户[:密码]@][协议[(地址)]]/库名[?参数]，库名在最后一个 / 之后。
  local head=${mysql_dsn%/*} tail=${mysql_dsn##*/} cred= netaddr proto addr host port db user pass
  [[ $mysql_dsn == */* ]] ||
    fail "KART_MYSQL_DSN 格式不正确（缺少 /库名）：$(redact_dsn "$mysql_dsn")"
  db=${tail%%\?*}
  if [[ $head == *@* ]]; then
    cred=${head%@*}
    netaddr=${head##*@}
  else
    netaddr=$head
  fi
  user=${cred%%:*}
  pass=
  [[ $cred == *:* ]] && pass=${cred#*:}
  proto=${netaddr%%(*}
  addr=
  [[ $netaddr == *"("*")" ]] && { addr=${netaddr#*(}; addr=${addr%)}; }
  if [ "$proto" = unix ]; then
    [ -S "$addr" ] || fail "MySQL 套接字不存在：${addr}（KART_MYSQL_DSN 使用 unix 协议）"
    return 0
  fi
  read -r host port <<<"$(split_host_port "${addr:-127.0.0.1:3306}" 3306)"

  if ! tcp_open "$host" "$port"; then
    fail "无法连接 MySQL（$host:${port}）。kart-data 需要 MySQL 8.0.19 以上（推荐 8.4）。" \
      "Homebrew：brew install mysql@8.4 && brew services start mysql@8.4" \
      "          然后建库建账号：mysql -h127.0.0.1 -P3306 -uroot -p < server-go/scripts/init-mysql.sql" \
      "          （Homebrew 安装的 root 默认没有密码，提示输入密码时直接回车）" \
      "Docker：  docker compose -f server-go/scripts/dev-deps.compose.yml up -d（同时启动 MySQL 与 Redis，库与账号已建好）" \
      "如果 MySQL 不在默认地址，请设置 KART_MYSQL_DSN，例如：" \
      "  KART_MYSQL_DSN='kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci'"
  fi
  if ! command -v mysql >/dev/null 2>&1; then
    echo "提示：未安装 mysql 命令行客户端，只检查了 $host:$port 端口可达，跳过账号与库检查。" >&2
    return 0
  fi
  local output collation
  if ! output=$(MYSQL_PWD=$pass mysql --protocol=TCP -h "$host" -P "$port" -u "$user" \
    --connect-timeout=5 --batch --skip-column-names \
    -e "SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=DATABASE()" \
    "$db" 2>&1); then
    fail "MySQL 可达，但无法用 KART_MYSQL_DSN 中的账号登录库 ${db}：" \
      "$output" \
      "请用管理员执行：mysql -h$host -P$port -uroot -p < server-go/scripts/init-mysql.sql" \
      "（它创建库 kartsim 与账号 kart/kart；若你用了别的账号或密码，请相应修改 KART_MYSQL_DSN）"
  fi
  collation=$(printf '%s' "$output" | tail -n 1)
  if [ "$collation" != utf8mb4_0900_as_ci ]; then
    echo "提示：库 $db 的默认排序规则是 ${collation}，建议 utf8mb4_0900_as_ci（见 server-go/scripts/init-mysql.sql）。" >&2
  fi
}

check_redis() {
  local host port reply
  read -r host port <<<"$(split_host_port "$redis_addr" 6379)"
  if ! tcp_open "$host" "$port"; then
    fail "无法连接 Redis（$host:${port}）。kart-data 用它保存在线昵称和游戏节点注册，没有它无法进入联机大厅。" \
      "Homebrew：brew install redis && brew services start redis" \
      "Docker：  docker compose -f server-go/scripts/dev-deps.compose.yml up -d redis" \
      "如果 Redis 不在默认地址，请设置 KART_REDIS_ADDR（以及 KART_REDIS_PASSWORD / KART_REDIS_DB）。"
  fi
  command -v redis-cli >/dev/null 2>&1 || return 0
  if [ -n "${KART_REDIS_PASSWORD:-}" ]; then
    reply=$(REDISCLI_AUTH=$KART_REDIS_PASSWORD redis-cli -h "$host" -p "$port" \
      -n "${KART_REDIS_DB:-0}" ping 2>&1 || true)
  else
    reply=$(redis-cli -h "$host" -p "$port" -n "${KART_REDIS_DB:-0}" ping 2>&1 || true)
  fi
  [ "$reply" = PONG ] || fail "Redis（$host:${port}）可达，但 PING 没有成功：$reply" \
    "请检查 KART_REDIS_PASSWORD 与 KART_REDIS_DB。"
}

if [ "${KART_SKIP_DEPENDENCY_CHECK:-}" != 1 ]; then
  check_mysql
  check_redis
fi

command -v go >/dev/null 2>&1 ||
  fail "找不到 go 命令。请安装 Go 1.26 或更高版本：brew install go（或 https://go.dev/dl/）"
command -v curl >/dev/null 2>&1 || fail "找不到 curl 命令，无法检查服务是否就绪。"

# ------------------------------------------------------ 集群密钥与构建 --------

if [ -z "${KART_CLUSTER_SECRET:-}" ]; then
  # 开发用密钥：生成一次后复用，让重启前后签发的票据与节点身份保持一致。
  secret_file="$state_dir/cluster-secret"
  mkdir -p "$state_dir"
  if [ ! -s "$secret_file" ]; then
    (umask 077 && od -An -tx1 -N32 /dev/urandom | tr -d ' \n' >"$secret_file.tmp" &&
      mv -f "$secret_file.tmp" "$secret_file")
    echo "已生成开发用集群密钥：$secret_file"
  fi
  chmod 600 "$secret_file"
  KART_CLUSTER_SECRET=$(cat "$secret_file")
fi
[ "${#KART_CLUSTER_SECRET}" -ge 32 ] ||
  fail "KART_CLUSTER_SECRET 至少需要 32 个字符（可用 openssl rand -base64 48 生成）。"
# 不 export：密钥只通过 start_service 传给 kart-data 与 kart-game，npm 与 Vite 拿不到它。
cluster_secret=$KART_CLUSTER_SECRET
unset KART_CLUSTER_SECRET

if [[ ! -d "$root/client/node_modules" ]]; then
  (cd "$root/client" && npm ci)
fi

echo "构建 Go 服务…"
(cd "$server_dir" && go build -o bin/ ./cmd/kart-data ./cmd/kart-game)

# 运行私有副本：之后在 server-go 里重新 go build 不会替换正在运行的可执行文件。
runtime_dir=$(mktemp -d "${TMPDIR:-/tmp}/kartsim-local.XXXXXX")
cp "$server_dir/bin/kart-data" "$server_dir/bin/kart-game" "$runtime_dir/"

# ------------------------------------------------------------ 进程管理 --------

pids=()
labels=()
client_pid=
stopping=0

# descendants PID：列出 PID 的全部子孙进程（npm → vite 之类的进程树）。
descendants() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do
    echo "$child"
    descendants "$child"
  done
}

# stop_group SECONDS PID...：发送 SIGTERM，最多等待 SECONDS 秒，超时则 SIGKILL。
stop_group() {
  local limit=$(($1 * 10)) ticks=0 pid alive
  shift
  [ "$#" -gt 0 ] || return 0
  for pid in "$@"; do kill -TERM "$pid" 2>/dev/null || true; done
  while :; do
    alive=
    for pid in "$@"; do
      if kill -0 "$pid" 2>/dev/null; then alive="$alive $pid"; fi
    done
    [ -n "$alive" ] || break
    if [ "$ticks" -ge "$limit" ]; then
      echo "进程$alive 未按时退出，强制结束。" >&2
      for pid in $alive; do kill -KILL "$pid" 2>/dev/null || true; done
      break
    fi
    sleep 0.1
    ticks=$((ticks + 1))
  done
  for pid in "$@"; do wait "$pid" 2>/dev/null || true; done
}

stop_services() {
  [ "$stopping" = 0 ] || return 0
  stopping=1
  # 停止过程中再按 Ctrl-C 不打断清理；每一步都有超时。
  trap '' INT TERM HUP
  local game_pids=() index=1
  if [ -n "$client_pid" ]; then
    # shellcheck disable=SC2046 # 进程号列表按空白拆分
    stop_group 5 "$client_pid" $(descendants "$client_pid")
  fi
  # 先停游戏节点（会冲刷发件箱并通知数据服务下线），最后停数据服务。
  while [ "$index" -lt "${#pids[@]}" ]; do
    game_pids+=("${pids[$index]}")
    index=$((index + 1))
  done
  stop_group 10 ${game_pids[@]+"${game_pids[@]}"}
  if [ "${#pids[@]}" -gt 0 ]; then stop_group 10 "${pids[0]}"; fi
  if [ -n "${runtime_dir:-}" ]; then rm -rf -- "$runtime_dir"; fi
}
trap stop_services EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# 服务在独立进程组中，关闭终端时收不到 SIGHUP，由这里转成正常清理。
trap 'exit 129' HUP

# start_service LABEL VAR=值... 程序：在 server-go 目录下启动，日志加上 [LABEL] 前缀。
# 变量在子 shell 里 export 后再 exec，而不是作为 env 的参数：MySQL 密码与集群密钥
# 不会出现在 ps 能看到的命令行里，也只传给这一个服务。
# set -m 让服务进入独立的进程组：终端的 Ctrl-C 只送到本脚本（和 Vite），再由
# stop_services 按“游戏节点 → 数据服务”的顺序停止，游戏节点下线时数据服务仍在运行。
start_service() {
  local label=$1
  shift
  set -m
  (
    cd "$server_dir" || exit 1
    while [ "$#" -gt 1 ]; do
      export "$1"
      shift
    done
    exec "$1"
  ) > >(awk -v prefix="[$label] " '{ print prefix $0; fflush() }') 2>&1 &
  pids+=("$!")
  set +m
  labels+=("$label")
}

# wait_ready LABEL PID URL SECONDS：轮询 healthz 直到就绪。
wait_ready() {
  local label=$1 pid=$2 url=$3 ticks=0
  while [ "$ticks" -lt $(($4 * 2)) ]; do
    if curl -fsS --max-time 2 "$url/multiplayer/healthz" >/dev/null 2>&1; then return 0; fi
    if ! kill -0 "$pid" 2>/dev/null; then fail "$label 启动时退出，请查看上面的日志。"; fi
    sleep 0.5
    ticks=$((ticks + 1))
  done
  fail "$label 在 $4 秒内没有就绪（$url/multiplayer/healthz）。"
}

# 其余账号经济变量（KART_ADMIN_USERNAMES、KART_ALLOW_GUESTS、KART_TRUSTED_PROXIES、
# KART_EXP_RATE 等）若已设置，会随环境原样传给服务。
start_service data \
  KART_DATA_ADDR="$data_addr" KART_DATA_PORT="$data_port" \
  KART_INTERNAL_LISTEN="$internal_listen" \
  KART_MYSQL_DSN="$mysql_dsn" KART_REDIS_ADDR="$redis_addr" \
  KART_CLUSTER_SECRET="$cluster_secret" \
  KART_REGISTRATION="$registration" \
  "$runtime_dir/kart-data"
# 首次连接 MySQL 时服务端最多重试 30 秒，再加上建表时间。
wait_ready kart-data "${pids[0]}" "$data_url" 60

node_ids=()
index=0
for port in "${game_ports[@]}"; do
  index=$((index + 1))
  node_id="game-$index"
  node_ids+=("$node_id")
  start_service "$node_id" \
    KART_GAME_ADDR="$game_addr" KART_GAME_PORT="$port" \
    KART_NODE_ID="$node_id" KART_NODE_NAME="本机游戏服 $index" \
    KART_PUBLIC_ORIGIN="$(game_origin_for "$port")" \
    KART_DATA_INTERNAL_URL="$internal_url" \
    KART_OUTBOX_DIR="$state_dir/outbox-$node_id" \
    KART_CLUSTER_SECRET="$cluster_secret" \
    "$runtime_dir/kart-game"
done
index=1
for port in "${game_ports[@]}"; do
  wait_ready "${labels[$index]}" "${pids[$index]}" "http://$game_probe:$port" 30
  index=$((index + 1))
done

# 游戏节点就绪后会立即向数据服务注册；确认它们出现在玩家看到的列表里。
missing=
for attempt in {1..20}; do
  servers=$(curl -fsS --max-time 2 "$data_url/multiplayer/game-servers" 2>/dev/null || true)
  missing=
  for node_id in "${node_ids[@]}"; do
    case $servers in
      *"\"nodeId\":\"$node_id\""*) ;;
      *) missing="$missing $node_id" ;;
    esac
  done
  [ -z "$missing" ] && break
  sleep 0.5
done
if [ -n "$missing" ]; then
  echo "警告：游戏节点$missing 没有出现在 $data_url/multiplayer/game-servers 中；" \
    "请检查上面的心跳日志（KART_CLUSTER_SECRET、KART_DATA_INTERNAL_URL 与 Redis）。" >&2
fi

echo
echo "数据服务：${data_url}（内部 API ${internal_listen}，仅供游戏节点访问）"
index=0
for port in "${game_ports[@]}"; do
  echo "游戏服 ${node_ids[$index]}：http://$game_probe:${port}（公布地址 $(game_origin_for "$port")）"
  index=$((index + 1))
done
case $registration in
  open) echo "注册：开放注册（KART_REGISTRATION=open），玩家在游戏登录界面自行注册。" ;;
  invite) echo "注册：需要邀请码（KART_REGISTRATION=invite），首个邀请码见上面 [data] 日志或 KART_BOOTSTRAP_INVITE。" ;;
  closed) echo "注册：已关闭（KART_REGISTRATION=closed），只能登录已有账号。" ;;
esac
echo "管理页面：${data_url}/multiplayer/admin"
if [ -n "$admin_usernames" ]; then
  echo "  管理员账号：${admin_usernames}（登录管理页面发放点券/金币/K币/经验）"
  echo "  尚未注册的管理员用户名必须凭引导邀请码注册（任何注册模式）：邀请码见上面 [data] 日志中" \
    "“Bootstrap invitation for KART_ADMIN_USERNAMES” 一行的 invite=…" \
    "${KART_BOOTSTRAP_INVITE:+（即 KART_BOOTSTRAP_INVITE；已被使用时日志里是新生成的邀请码）}；" \
    "在游戏登录界面注册时点“有邀请码？”填入。"
else
  echo "  提示：未设置 KART_ADMIN_USERNAMES，只有数据库中原本标记为管理员的账号能使用管理页面；" \
    "指定管理员：KART_ADMIN_USERNAMES=你的用户名 ./run-full-local.sh（或 ./run-lan.sh）"
fi

# Vite 的局域网代理：/multiplayer/ws 转给第一个游戏节点，其余 /multiplayer/、/api/ 转给数据服务。
export KART_LAN_BACKEND=${KART_LAN_BACKEND:-$data_url}
export KART_LAN_GAME_BACKEND=${KART_LAN_GAME_BACKEND:-http://$game_probe:${game_ports[0]}}
# 前端默认连接 http://127.0.0.1:8787；数据服务换了地址或端口时要告诉它（同源代理模式除外）。
if [ "${VITE_MULTIPLAYER_SAME_ORIGIN:-}" != 1 ]; then
  export VITE_MULTIPLAYER_BACKEND_ORIGIN=${VITE_MULTIPLAYER_BACKEND_ORIGIN:-$data_url}
fi

echo "启动前端（地址由 Vite 打印）…"
# KART_VITE_HOST（由 run-lan.sh 设置）覆盖 `npm run dev` 中的回环地址。
# 后写的 --port/--host 覆盖 dev 脚本里的值（Vite 对重复选项取最后一个）。
(cd "$root/client" && exec npm run dev -- --port "$vite_port" ${KART_VITE_HOST:+--host "$KART_VITE_HOST"}) &
client_pid=$!

# 任一进程退出就结束整个会话（EXIT 时统一清理）。
while :; do
  if ! kill -0 "$client_pid" 2>/dev/null; then
    status=0
    wait "$client_pid" || status=$?
    client_pid=
    exit "$status"
  fi
  index=0
  while [ "$index" -lt "${#pids[@]}" ]; do
    if ! kill -0 "${pids[$index]}" 2>/dev/null; then
      echo "错误：${labels[$index]} 意外退出，正在停止其余进程。" >&2
      exit 1
    fi
    index=$((index + 1))
  done
  sleep 1
done
