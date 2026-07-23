# AI Brief

AI Brief 是一个面向中文用户的 AI 资讯聚合、趋势总结与研究问答网站。

- 正式网站：https://ai-brief-drab.vercel.app/
- 正式代码：`main` 分支
- 部署方式：Vercel 监听 `main`，合并或提交后自动部署

以后在新设备或新的 Codex 会话中，直接读取本仓库 `main` 分支即可继续开发；不需要依赖旧设备上的本地文件。

## 当前功能

- 聚合 100 个数据源，优先覆盖中文科技媒体、官方实验室、学术研究、开发者社区和国际科技媒体
- 数据源分类、在线状态、启用/停用管理；停用后后端停止抓取
- 同题事件聚合，三个及以上来源提及时显示多源标签
- 今日 AI 总结与核心趋势
- 主题订阅：首页优先展示关注方向
- 中文/英文全页翻译与浏览器、服务端缓存
- 资讯详情：原文图片、原文信息、AI 摘要和重点句
- 我的收藏
- 基于当前资讯、历史上下文和引用来源的 AI 问答
- 页面切换、加载阶段、卡片、详情抽屉和数据源状态动效

可信度评分保留在后台排序逻辑中，不在前台展示可信度标签或筛选器。

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript
- Vercel
- Cloudflare Workers AI / Qwen

## 目录

```text
app/page.tsx              主界面与前端交互
app/globals.css           全站设计系统与动画
app/api/news/route.ts     数据源抓取、聚合与缓存
app/api/article/route.ts  原文详情与摘要数据
app/api/ask/route.ts      AI 研究问答
app/api/summary/route.ts  今日 AI 总结
app/api/translate/route.ts 全页翻译与缓存
lib/ai.ts                 千问及兼容模型调用
lib/sources.ts            数据源配置
```

## 千问配置

AI 问答、每日总结和翻译优先使用底层千问模型。推荐在 Vercel Environment Variables 和本地 `.env.local` 中配置 Cloudflare Workers AI：

```bash
CLOUDFLARE_ACCOUNT_ID=你的Cloudflare账号ID
CLOUDFLARE_API_TOKEN=你的WorkersAI令牌
AI_MODEL=@cf/qwen/qwen3-30b-a3b-fp8
```

也支持 OpenAI Chat Completions 兼容接口：

```bash
AI_API_KEY=你的密钥
AI_BASE_URL=兼容接口地址
AI_MODEL=模型名称
```

模型未配置或暂时调用失败时，接口会使用本地归纳或翻译降级方案，避免页面中断。

## 本地开发与检查

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
npm run build
```

提交正式版本前必须执行 `npm run build`，确认 Next.js 编译和 TypeScript 检查通过。

## 发布流程

1. 从 `main` 创建修改分支。
2. 完成功能后执行 `npm run build`。
3. 提交并创建 Pull Request。
4. 用户确认发布后合并到 `main`。
5. 等待 Vercel 状态成功，并检查正式网站。

不要将 `.env.local`、密钥、构建目录、截图或临时文件提交到 GitHub。
