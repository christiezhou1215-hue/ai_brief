# AI Brief

AI Brief 是一个面向中文用户的 AI 资讯聚合、趋势总结与研究问答网站。

- 正式网站：https://ai-signal-brief-zhou.vercel.app/
- 正式代码：`main` 分支
- 部署方式：Vercel 监听 `main`，合并或提交后自动部署

以后在新设备或新的 Codex 会话中，直接读取本仓库 `main` 分支即可继续开发；不需要依赖旧设备上的本地文件。

## 当前功能

- 聚合 218 个数据源，其中约 158 个中文来源，覆盖科技媒体、官方机构、高校实验室、学术研究、开发者社区和国际一手来源
- 数据源按一手官方、专业科技媒体、综合新闻媒体、开发者与社区四类准入，并按具体抓取通道标记 T1、T1.5、T2
- 同一机构的官网、AI 专栏、社交账号或搜索聚合结果分别管理，避免将机构权威性等同于全部内容质量
- 动态来源质量分综合抓取成功率、信息完整度、多源印证率、噪音率与时效；低质来源自动降权，连续三个统计日低于阈值后暂停抓取
- 完全重复、相似报道、关联趋势三级整理；三个及以上来源提及时显示多源标签
- 事件级排序综合来源质量、行业影响、时效、多源验证、信息完整度与用户主题相关性
- 推荐结果提供“核心变化、行业影响、排序原因、证据来源和不确定性”解释
- 今日 AI 总结与核心趋势
- 主题订阅、自定义主题与首页优先展示
- 中文/英文全页翻译与浏览器、服务端缓存
- 资讯详情：原文图片、原文信息、AI 摘要和重点句
- 我的收藏
- 基于当前资讯、历史上下文和引用来源的 AI 问答
- 页面切换、加载阶段、卡片、详情抽屉和数据源状态动效

可信度评分保留在后台排序逻辑中，不在前台展示可信度标签或筛选器。

## 信息质量与推荐策略

数据不会在抓取后直接进入首页。RSS、Atom、官方接口或搜索聚合结果先统一为事件结构，再经过编码、来源尾缀、标题与摘要完整性、AI 相关性、营销噪音、早报合集拆分及重复事件检查。搜索聚合只用于发现线索，不自动视为一手可信来源。

精选机制采用 `selection-v12.0`。内容先进入质量闸门和事件识别，再流转到精选、候选、观察或淘汰内容池。匿名爆料默认进入候选区，营销、普通转载和没有信息增量的内容执行硬性降权。

事件总分采用可解释的权重：

```text
来源质量 25% + 行业影响 25% + 时效性 15% + 多源验证 15%
+ 信息完整度 10% + 用户相关性 10%
```

DeepSeek 只输出是否存在新事实、核心变化、涉及对象、具体数据、行业影响、转载风险、营销风险和不确定性等结构化证据，不直接给最终总分。最终准入、淘汰与排序始终受到确定性的质量规则约束。

每个信源通道记录获取方式、监控范围、信号密度、首发贡献度、抓取成功率、多源印证率、噪音率和最近复核日期。用户的阅读、收藏与屏蔽动作按评分版本记录，用于后续比较精选效果和校准权重。

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript
- Vercel
- DeepSeek API

## 目录

```text
app/page.tsx               主界面与前端交互
app/globals.css            全站设计系统与动画
app/api/news/route.ts      数据源抓取、聚合与缓存
app/api/article/route.ts   原文详情与摘要数据
app/api/ask/route.ts       AI 研究问答
app/api/summary/route.ts   今日 AI 总结
app/api/translate/route.ts 全页翻译与缓存
app/api/feedback/route.ts  跨设备精选反馈记录
lib/ai.ts                  DeepSeek 模型调用
lib/db.ts                  Neon/Postgres 数据库连接与建表
lib/article-security.ts    原文抓取来源安全限制
```

## DeepSeek 配置

AI 问答、每日总结、详情摘要和翻译统一使用 DeepSeek。请在 Vercel Environment Variables 和本地 `.env.local` 中配置：

```bash
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DATABASE_URL=你的Neon或Postgres连接地址
```

密钥可以在 https://platform.deepseek.com/api_keys 创建。不要将真实密钥提交到 GitHub。

项目只使用 DeepSeek。模型未配置或调用失败时，接口会使用本地归纳或翻译降级方案，避免页面中断。

精选反馈通过 Neon/Postgres持久化。首次写入时会自动创建
`selection_feedback` 表和评分版本索引；数据库未配置时自动降级为浏览器本地记录，不影响资讯浏览。

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
