-- KartSim 本机开发用 MySQL 初始化脚本（MySQL >= 8.0.19，推荐 8.4）。
--
-- 用管理员账号执行一次即可，重复执行是安全的：
--   mysql -h127.0.0.1 -P3306 -uroot -p < server-go/scripts/init-mysql.sql
--
-- 它创建：
--   * 数据库 kartsim（游戏数据）与 kartsim_test（Go 单元测试，KART_TEST_MYSQL_DSN 使用）；
--     默认排序规则 utf8mb4_0900_as_ci（大小写不敏感、重音敏感，与旧 Java 版一致）；
--   * 账号 kart，密码 kart —— 与 kart-data 的默认 KART_MYSQL_DSN 对应：
--       kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci
--
-- 账号主机写成 '%'：Homebrew 的 MySQL 默认只监听 127.0.0.1，所以它实际只能从本机连接；
-- 如果你的 MySQL 监听了局域网地址，请改成 'kart'@'127.0.0.1'。若已存在更具体的同名账号
-- （例如 'kart'@'127.0.0.1'），MySQL 会优先匹配那个账号，本脚本不会改动它的密码。
--
-- 这个密码只适合本机开发。生产环境请换成强密码（同时修改 KART_MYSQL_DSN），
-- 或直接使用 docker compose（账号与密码取自 .env）。表结构由 kart-data 启动时自动创建与迁移，
-- 这里不需要建表。

CREATE DATABASE IF NOT EXISTS kartsim
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;
ALTER DATABASE kartsim CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

CREATE DATABASE IF NOT EXISTS kartsim_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;
ALTER DATABASE kartsim_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

CREATE USER IF NOT EXISTS 'kart'@'%' IDENTIFIED BY 'kart';
GRANT ALL PRIVILEGES ON kartsim.* TO 'kart'@'%';
GRANT ALL PRIVILEGES ON kartsim_test.* TO 'kart'@'%';
