#!/usr/bin/env bash
# 让局域网中的其他设备也能运行可开发前端：数据服务与游戏节点监听所有网卡，
# 前端经 HTTPS 提供，并把数据服务和唯一的游戏节点同源代理到页面地址上。
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# 监听所有网卡，并接受设备使用的任意主机名。内部 API（KART_INTERNAL_LISTEN，默认
# 127.0.0.1:8790）保持只在本机监听，不要改成 0.0.0.0。
export KART_DATA_ADDR=0.0.0.0
export KART_GAME_ADDR=0.0.0.0
export KART_LAN_HOSTS='*'
export KART_VITE_HOST=0.0.0.0
# 其他设备经 Vite 代理（本机 127.0.0.1，xfwd）访问数据服务：信任回环地址上的代理转发的
# X-Forwarded-For，注册限流（每个 IP 每小时 5 次）才按设备的真实地址计算，而不是把所有
# 设备都算成 127.0.0.1。回环地址也是 kart-data 的默认值，这里显式传入；局域网设备直连
# 8787 时来源是它自己的地址，不受信任，无法伪造 X-Forwarded-For。
export KART_TRUSTED_PROXIES=${KART_TRUSTED_PROXIES:-127.0.0.1/32,::1/128}

# 其他设备的 HTTPS 页面只能连 wss://；这里只运行一个游戏节点，由 Vite 在页面同源上代理
# /multiplayer/ws，游戏服列表中它的 origin 为 null（KART_PUBLIC_ORIGIN=same-origin）。
if [ "${KART_GAME_NODES:-1}" != 1 ]; then
  echo "提示：run-lan.sh 只运行 1 个游戏节点（经前端同源代理），忽略 KART_GAME_NODES=${KART_GAME_NODES}。" >&2
fi
export KART_GAME_NODES=1
export KART_GAME_PUBLIC_ORIGIN=same-origin

# 其他设备需要 HTTPS 才有游戏所需的安全上下文 API。每次运行都重新生成自签名证书，
# 覆盖本机当前的全部地址；每台设备的浏览器会询问一次是否信任。
ips=$(ifconfig | awk '/inet /{print $2}')
cert_dir="$root/rewrite/.lan-cert"
mkdir -p "$cert_dir"
chmod 700 "$cert_dir"
san="DNS:localhost,DNS:$(hostname)"
for ip in $ips; do san="$san,IP:$ip"; done
# 私钥只给本用户：macOS 自带的 LibreSSL openssl 按 umask 创建 key.pem（通常 0644），
# 而且覆盖旧文件时保留旧权限，所以生成后再 chmod 一次。
(umask 077 && openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=KartSim LAN" \
  -addext "subjectAltName=$san" -addext "extendedKeyUsage=serverAuth" \
  -keyout "$cert_dir/key.pem" -out "$cert_dir/cert.pem" 2>/dev/null)
chmod 600 "$cert_dir/key.pem"
export KART_LAN_CERT="$cert_dir/cert.pem" KART_LAN_KEY="$cert_dir/key.pem"
# Vite 代理：/multiplayer/ws → 游戏节点；其余 /multiplayer/ 与 /api/ → 数据服务。
export KART_LAN_BACKEND="http://127.0.0.1:${KART_DATA_PORT:-${KART_SERVER_PORT:-8787}}"
export KART_LAN_GAME_BACKEND="http://127.0.0.1:${KART_GAME_BASE_PORT:-8788}"
export VITE_MULTIPLAYER_SAME_ORIGIN=1

for ip in $ips; do
  [[ $ip == 127.* ]] || echo "局域网游戏地址：https://$ip:${KART_VITE_PORT:-8780}/" \
    "（管理页面 https://$ip:${KART_VITE_PORT:-8780}/multiplayer/admin）"
done
exec "$root/run-full-local.sh"
