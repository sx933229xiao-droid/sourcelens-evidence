# SourceLens — AI 接续入口

## 先读与启动

1. 阅读本文件、`README.md`，以及本机存在时的 `HANDOFF.local.md`。README 面向公开使用；本机路径与临时状态只放在被 Git 忽略的本地交接文件中。
2. 先执行 `git status --short --branch`，保留已有修改。继续当前 checkout，不要重新初始化、重复克隆、重置或清理仓库。
3. 本机已有 `.env.local` 时直接沿用，不能用 `.env.example` 覆盖；不要输出、提交或复制 API Key 到交接文档。`/api/status` 只检查配置项存在，不证明供应商鉴权或额度有效。
4. 沿用 Node.js 22（至少 22.13）、npm 和 `package-lock.json`。依赖已存在且锁文件未变时，直接使用；依赖缺失或需要与锁文件同步时才运行 `npm ci`。dev/build 会从已安装的 pdfjs-dist 准备同版本 Worker 和文字资源，不使用外部 PDF CDN。
5. 需要运行页面时先检查现有本地服务；未运行则在仓库根目录执行 `npm run dev`，使用终端给出的地址。默认地址为 `http://127.0.0.1:3000`。不要假设上一聊天的进程仍然存在，也不要停止无关进程。

## 产品与当前基线

- 已实现 V0.4：在 V0.3 本地项目、自动保存、结果复用及 Markdown 导出上，增加浏览器文本型 PDF 导入、页码范围预览、Read / Edit 和逐字引用高亮。实际验证范围见 README。
- 产品比较资料中的陈述关系，不裁定客观真伪。信息缺失不等于冲突，不同年份或适用条件应区分。
- 使用 Next.js App Router、React、TypeScript、Tailwind CSS、自定义 CSS 和 Zod；原生 IndexedDB 仅在浏览器保存项目，无云数据库、账户、多 Agent 或任务队列。
- 每项目保留两份当前文本、文件名及 Edited 标记、最新成功结果和分析时间。恢复时原样保留 Findings 与 omittedFindings，不重复分析或重新计算遗漏数。编辑资料立即清空分析；不保存原文件、历史版本或原始模型响应。
- PDF 上限 50 MB；先读取总页数，最多 5 页的文档自动全文预览，较长文档先选连续范围再提取。所有 PDF 均需预览确认；超 10,000 字符时禁用导入，允许删改，不能自动截断。取消不修改当前资料或分析。
- PDF 元信息为 sourceFiles 中可选的 pdf: { pageCount, fromPage, toPage }，兼容旧 IndexedDB v1 记录。仅保存选中文本和范围，不存 PDF、未选中全文或解析中间状态。页码按文件顺序计数；预览删改显示 Edited。
- 阅读视图与编辑器使用同一文本；Locate in source 切到 Read 并高亮首次逐字匹配，定位/切换视图不写库。旧分析可用于验证阅读交互，无需额外消耗 NVIDIA 额度。
- 文本编辑采用 500ms 防抖，写入绑定捕获的项目 ID，切换前提交待保存内容；没有通用任务队列。Clear / Try Example 只在会覆盖当前资料或分析时确认。Markdown 导出全部发现，不受界面筛选影响。
- AI 为服务端一次非流式 Chat Completions 调用，密钥只在服务端读取。输入为 `{ sourceA, sourceB }`，成功响应包含 `findings` 和 `omittedFindings`。
- 每份资料比较时最多 10,000 字符。每条发现独立校验结构及逐字引用：过滤无效项、保留有效项；响应不可解析或全部发现不可用时才报错。
- 保持五类关系：Agreement、Potential Conflict、Context Difference、Single-Source Claim、Needs Review。当前真实示例已验证 Agreement、Potential Conflict 和 Single-Source Claim；另外两类尚未单独实测，也不代表全部场景准确率验证。
- 分析完成后桌面资料区/结果区约 55:45；沿用暖白、墨绿、克制的阅读工作台。TXT/Markdown 导入不上传文件，点击 Compare Sources 后才发送编辑区文本。
- 云部署尚未完成，Google Cloud Run 仅在评估。不要把 README 的计划、示例或优化建议写成已完成的能力。

## 关键代码定位

| 文件 | 职责 |
| --- | --- |
| `src/components/comparison-workspace.tsx` | 输入、文件元信息、请求状态、结果失效、原文选中定位 |
| `src/components/project-toolbar.tsx` | 项目切换、新建、命名、删除、保存状态与导出入口 |
| `src/lib/project-store.ts`、`src/lib/markdown-report.ts` | 本地项目结构与 IndexedDB、完整 Markdown 报告 |
| `src/components/source-panel.tsx` | 资料导入、Read/Edit、原文高亮、文件元信息与错误提示 |
| `src/lib/pdf-import.ts`、`src/components/pdf-import-dialog.tsx` | PDF 页数读取、选页提取、可编辑预览、取消与 Worker 清理 |
| `scripts/prepare-pdfjs-assets.mjs` | 从安装包准备 public/pdfjs 下的 Worker/CMap/字体；生成资源不提交 |
| `src/components/findings-panel.tsx` | 关系筛选、发现列表、证据展开 |
| `src/app/globals.css` | 现有视觉样式与响应式布局 |
| `src/lib/llm.ts` | 服务端供应商调用、提示词、60 秒超时、最小耗时统计 |
| `src/lib/comparison-schema.ts` | 共享类型、输入限制、五类关系及独立引用校验 |
| `src/app/api/compare/route.ts`、`src/app/api/status/route.ts` | 对照接口与配置存在性检查 |

## 工作方式与必要验证

- 默认单代理，复用现有实现，只完成当前用户任务。不要额外创建需求文档、测试框架、独立复核或治理流程。
- 当前任务不涉及 AI 时，保持模型、推理参数、提示词、校验逻辑和服务端架构不变。README 中降低 `reasoning_budget` 的建议尚未实施，也不是下一轮的自动任务。
- 文档修改运行 `git diff --check` 并查看差异；应用修改运行 `npm run build`（包含 TypeScript 检查），再实际操作受影响的主流程。已有验证通过后，不重复扩大测试。
- 仅在任务需要验证 AI 时发起真实调用；可复用仍然打开的真实结果页。Try Example 只填虚构资料，不能用模拟发现代替真实调用。
- 真实示例的预期关系：截止日期潜在冲突、个人参赛资格一致、团队资格为 B 的单方信息；判断与原文引用要分别检查。
- `next-env.d.ts` 是已被跟踪的 Next.js 自动生成文件；dev/build 切换可能改变其中的 `.next/types` 与 `.next/dev/types` 引用。先看实际差异，不误当业务修改，不盲目重置已有内容，也不要顺手夹带进无关提交。
- 临时截图、日志、导入样例放在用户指定的临时目录。公开展示素材仅保留必要最终文件，例如 `docs/images/sourcelens-demo.png`。
- 提交时只暂存当前任务的明确文件；按用户授权提交、推送，保留已有历史和其他本地修改。更新 README 时保持开发状态真实，公开文档不加入本机绝对路径。
