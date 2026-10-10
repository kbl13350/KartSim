# syntax=docker/dockerfile:1
# KartSim Go 服务镜像：同一镜像包含 kart-data、kart-game 与 kart-migrate-sqlite，
# 由 command 选择运行哪个。构建：docker build -t kartsim-server:local .

FROM golang:1.26 AS build
WORKDIR /src
# 纯 Go 构建（modernc sqlite 不需要 cgo），产物是静态二进制，可在 Alpine 上运行。
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/ \
      ./cmd/kart-data ./cmd/kart-game ./cmd/kart-migrate-sqlite

FROM alpine:3.22
# ca-certificates：连接启用 TLS 的 MySQL/Redis；tzdata：日志时间；wget（busybox）供健康检查。
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -S -g 10001 kart \
 && adduser -S -D -H -u 10001 -G kart -h /var/lib/kart kart \
 && mkdir -p /var/lib/kart/outbox \
 && chown -R kart:kart /var/lib/kart \
 && chmod 0700 /var/lib/kart /var/lib/kart/outbox
COPY --from=build /out/ /usr/local/bin/
# 反作弊插件（可选）：kart-game 会在 /usr/local/lib/kart/plugins 找 anticheat.wasm；
# 也可以挂载别处的插件，再用 KART_ANTICHEAT_PLUGIN 指定路径。
COPY plugins/ /usr/local/lib/kart/plugins/
USER 10001:10001
WORKDIR /var/lib/kart
# 容器内必须监听所有网卡才能被端口映射与同一网络的其他容器访问；
# 内部 API（KART_INTERNAL_LISTEN）的监听地址由 compose 显式设置，且不发布到宿主机。
ENV KART_DATA_ADDR=0.0.0.0 \
    KART_GAME_ADDR=0.0.0.0 \
    KART_OUTBOX_DIR=/var/lib/kart/outbox
EXPOSE 8787 8788
CMD ["kart-data"]
