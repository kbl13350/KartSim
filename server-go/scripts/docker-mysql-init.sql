-- docker compose 首次初始化 MySQL 数据卷时执行（挂载到 /docker-entrypoint-initdb.d）。
--
-- 镜像入口脚本已按 MYSQL_DATABASE / MYSQL_USER / MYSQL_PASSWORD 创建库 kartsim 与账号 kart，
-- 并授予该库的全部权限；服务器默认排序规则由 compose 的 --collation-server 指定。
-- 这里再显式固定库的字符集，防止有人改了服务器参数后新库落到其他排序规则上。
-- 表结构由 kart-data 启动时自动创建与迁移。
ALTER DATABASE kartsim CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;
