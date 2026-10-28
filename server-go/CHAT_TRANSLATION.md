# 多人房间 AI 聊天翻译

后台「AI 聊天翻译」中填入 DeepSeek API Key，保存后可点击「测试已保存的配置」。打开自动翻译后，其他玩家的房间消息按接收者的游戏语言译成中文、英文或韩文。聊天记录保留原文，另起一行显示 `[AI]` 译文；角色气泡显示译文。自己的消息、纯表情动作不翻译。未登录、未启用、密钥未配置或服务失败时保留原文，聊天继续正常工作。当前范围为多人准备房间，不包含比赛中的聊天或私信。

模型默认 `deepseek-flash`，可选 `deepseek-v4-pro`。使用官方 `https://api.deepseek.com/chat/completions`，关闭思考模式，最多输出 512 token，超时 10 秒；只发送单条消息及目标语言，不附带账号、昵称、聊天历史。协议见 <https://api-docs.deepseek.com/api/create-chat-completion/>。

## 配置与接口

- `GET /api/admin/translation`：管理员读取启用状态、模型和 `keyConfigured`，不回传密钥或密文。
- `PUT /api/admin/translation`：管理员保存 `{enabled, model, apiKey, clearKey}`。`apiKey` 留空保留旧密钥，非空替换；`clearKey: true` 清除并禁用翻译。
- `POST /api/admin/translation/test`：管理员用已保存的配置翻译固定示例，可在启用自动翻译之前检查连接。测试会调用供应商 API。
- `POST /api/chat/translate`：登录玩家提交 `{text, target}`，正文最多 120 Unicode 字符，目标仅 `zh-CN/en/ko`；禁用返回 `{enabled:false}`，成功返回 `{enabled:true, text, target}`。异常只返回通用错误，不包含供应商响应正文。

密钥使用 AES-GCM 加密后存入现有 `app_settings` 表的 `chatTranslation` 行，不需要数据库迁移。加密密钥从 `KART_CLUSTER_SECRET` 派生；恢复数据库需保留相同集群密钥，轮换集群密钥后须在后台重新填写 DeepSeek Key。禁止将真实 Key 写入 Git、客户端配置或日志。

每账号每分钟最多 120 次翻译请求，全局最多 600 次；Redis 限流不可用时拒绝付费调用。供应商并发最多 8 个，相同消息/目标语言/密钥/模型的请求合并；成功结果缓存 10 分钟，最多 512 条。客户端失败后同一消息至少间隔 30 秒才重试，禁用状态短暂缓存 30 秒。后台保存后最迟约 30 秒随下一条房间更新生效，重新进入房间也会检查；现有已显示译文不会被撤回。

## 验证

- `go test -race ./internal/data/translation`
- `KART_TEST_MYSQL_DSN=... go test -race ./internal/data/api -run TestTranslation -v`（独立测试库；包含权限、密钥持久化、禁用、连接测试和模拟翻译）
- 客户端：`node --import ./src/physics/node-raw-test-hook.mjs --import tsx --test src/multiplayer/chat-translation.test.ts`
- 后台：`npm run build`；`npm run dev:mock` 提供模拟配置和连接测试，绝不发送真实翻译请求。

自动化测试使用模拟供应商响应。真实密钥的有效性、余额和供应商可用性以后台连接测试为准。
