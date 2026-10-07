#!/usr/bin/env bash
# Run the developable frontend and Java service for other devices on the LAN.
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# Spring maps SERVER_ADDRESS to server.address and KART_LANHOSTS to kart.lan-hosts.
# Listen on every interface and accept whichever address a device uses.
export SERVER_ADDRESS=0.0.0.0
export KART_LANHOSTS='*'
export KART_VITE_HOST=0.0.0.0

# Other devices need HTTPS for the game's secure-context APIs. Regenerate a
# self-signed certificate each run so it covers every current local address;
# browsers ask once per device to accept it. The Vite server then proxies the
# Java service on the page origin.
ips=$(ifconfig | awk '/inet /{print $2}')
cert_dir="$root/rewrite/.lan-cert"
mkdir -p "$cert_dir"
san="DNS:localhost,DNS:$(hostname)"
for ip in $ips; do san="$san,IP:$ip"; done
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=KartSim LAN" \
  -addext "subjectAltName=$san" -addext "extendedKeyUsage=serverAuth" \
  -keyout "$cert_dir/key.pem" -out "$cert_dir/cert.pem" 2>/dev/null
export KART_LAN_CERT="$cert_dir/cert.pem" KART_LAN_KEY="$cert_dir/key.pem"
export KART_LAN_BACKEND="http://127.0.0.1:${KART_SERVER_PORT:-8787}"
export VITE_MULTIPLAYER_SAME_ORIGIN=1

for ip in $ips; do
  [[ $ip == 127.* ]] || echo "LAN game address: https://$ip:8780/"
done
exec "$root/run-full-local.sh"
