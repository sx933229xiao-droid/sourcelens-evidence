# SourceLens — AI 接续入口

## 先读与启动

1. 阅读本文件、`README.md`，以及本机存在时的 `HANDOFF.local.md`。README 面向公开使用；本机路径与临时状态只放在被 Git 忽略的本地交接文件中。
2. 先执行 `git status --short --branch`，保留已有修改。继续当前 checkout，不要重新初始化、重复克隆、重置或清理仓库。
3. 本机已有 `.env.local` 时直接沿用，不能用 `.env.example` 覆盖；不要输出、提交或复制 API Key 到交接文档。`/api/status` 只检查配置项存在，不证明供应商鉴权或额度有效。
4. 沿用 Node.js 22（至少 22.13）、npm 和 `package-lock.json`。依赖已存在且锁文件未变时，直接使用；依赖缺失或需要与锁文件同步时才运行 `npm ci`。dev/build 会从已安装的 pdfjs-dist 准备同版本 Worker 和文字资源，不使用外部 PDF CDN。
5. 需要运行页面时先检查现有本地服务；未运行则在仓库根目录执行 `npm run dev`，使用终端给出的地址。默认地址为 `http://127.0.0.1:3000`。不要假设上一聊天的进程仍然存在，也不要停止无关进程。

## 产品与当前基线

- 已实现 V0.8 Research Studio：固定应用框架、可调整的 Findings / Detail / Source Inspector 三栏、窄屏抽屉和动效。保留 V0.7 的 AI、PDF、自动保存、标注、Markdown 和 JSON 备份行为。实际验证范围见 README。
- 产品比较资料中的陈述关系，不裁定客观真伪。信息缺失不等于冲突，不同年份或适用条件应区分。
- 使用 Next.js App Router、React、TypeScript、Tailwind CSS、自定义 CSS 和 Zod；原生 IndexedDB 仅在浏览器保存项目，无云数据库、账户、多 Agent 或任务队列。
- 每项目保留两份当前文本、文件名及 Edited 标记、最新成功结果和分析时间。恢复时原样保留 Findings 与 omittedFindings，不重复分析或重新计算遗漏数。资料实际变更时清空分析及标注；不保存原文件、历史版本或原始模型响应。
- 人工标注为 analysis.reviewByFinding 可选稀疏记录，以当前 findings 原始数组索引为键；reviewed / important / note 与 AI result 分离，旧记录默认为无标注。标记立即保存，纯文本备注沿用 500ms 防抖；全部清空时移除空记录，沿用 IndexedDB v1。
- 有实际人工标记或备注时，首次修改原文、确认导入替换或重新分析前必须提供可取消的确认；无标注不增加确认。新分析成功创建全新 analysis，不继承旧标注；失败和取消保留旧标注。Clear / Try Example / 删除沿用单次确认，准确说明人工内容的去除。
- 有分析的项目及新成功分析进入 Explorer，无分析进入 Workspace。Explorer 首次选择第一条有效证据，换 Finding 时优先沿用当前来源。模式、筛选、匹配及读到的位置留在当前会话，项目或分析更换后重置。标注变化使当前项不匹配时保留详情，主动改筛选才重新选择。
- 桌面布局偏好存于 localStorage 的 sourcelens.ui.v08，面板 ID 为 findings、detail、inspector。24 / 46 / 30 是默认比例，双击任一分割线重置。只持久化用户拖拽/键盘请求的比例、显式折叠和重置。窗口宽度适配与窄屏抽屉不覆盖桌面偏好。
- TXT / Markdown 和 PDF 均保留 50 MB 文件大小保护，不设置字符数量上限。PDF 先读取总页数，最多 5 页自动全文预览；长 PDF 可主动提取全文或连续页段。所有 PDF 均需预览确认；取消不修改当前资料或分析。
- PDF 元信息为 sourceFiles 中可选的 pdf: { pageCount, fromPage, toPage, pageMap? }，沿用 IndexedDB v1。pageMap 只存全文 UTF-8 SHA-256 和各物理页 UTF-16 半开区间，不存 PDF、逐页重复全文或解析对象；生成位置必须计入原有逐页 trim、页间分隔符和全文 trim。页码按文件顺序计数，不是印刷页标。
- PDF 预览最终文本不变才附带索引；导入后实际编辑通过既有标注保护确认才删除索引，保留文件名与范围。取消、备注和标记不使索引失效；普通撤销不自动恢复已删索引。旧项目缺索引仍正常使用，不能按文本长度或范围反推页码。
- 引文按全部逐字出现位置分别求页段，跨页的一次匹配与不同页的多次匹配分别呈现。点击中栏引文只更新 Source Inspector。右栏的页箭头浏览正文，匹配输入和 Jump to quote 定位精确偏移。Markdown 列出可信页段或全部候选，无索引保持旧格式。
- Export backup 导出当前内存完整 .sourcelens.json，格式 sourcelens-project/version 1；包含未保存备注但不包含原 PDF、密钥或视图状态。Restore project 核心数据/引用/标注关联不合法时拒绝，只有可选 PDF 索引无效则删除索引、恢复所有其余数据并提示页码不可用。
- 恢复总是新 UUID，重名加 (restored) 及序号，保留原分析时间和遗漏数，不重新调用 AI。先保存当前待保存内容，再用 projects.add 与 meta 活动 ID 在同一事务提交，成功后才切换。大于 100 MB 的备份先确认再读取，不沿用 50 MB 资料文件上限；不加整包校验和或新数据库。
- 阅读视图与编辑器使用同一文本。SourceReader 复用原始偏移和页锚，按定位版本处理滚动。备注、保存和无关状态变化不触发定位，正在退出的面板不写回阅读位置。秒表独立更新，资料面板和阅读组件复用稳定回调与 memo。
- 文本编辑采用 500ms 防抖，写入绑定捕获的项目 ID，切换前提交待保存内容；没有通用任务队列。Markdown 导出全部发现，不受界面筛选影响；仅为实际有标注的 Finding 添加人工内容，无标注旧项目导出格式保持不变，导出读取最新内存备注。
- AI 为服务端一次非流式 Chat Completions 调用，密钥只在服务端读取。输入为 `{ sourceA, sourceB }`，成功响应包含 `findings` 和 `omittedFindings`。
- 比较直接提交两份完整资料，保持通用 OpenAI-compatible 架构；不自动截断、压缩、分块或重试。容量由配置的模型服务决定；明确的容量拒绝保留全文并提示用户编辑或选页，不做特定供应商容量探测。
- 服务端模型调用超时 240 秒，前端兜底 255 秒；取消贯穿客户端、服务端和供应商请求，并防止迟到响应覆盖。分析期间冻结编辑、导入、标注和项目变更，允许阅读原文及旧结果、切换模式。失败或取消保留旧分析；原文变更仍清空分析。请求状态仅保存在内存中。
- 每条发现独立校验结构及逐字引用：过滤无效项、保留有效项；响应不可解析、全部发现不可用或 finish_reason 为 length 时才报错，不把达到输出上限的响应保存为成功分析。
- 保持五类关系：Agreement、Potential Conflict、Context Difference、Single-Source Claim、Needs Review。当前真实示例已验证 Agreement、Potential Conflict 和 Single-Source Claim；另外两类尚未单独实测，也不代表全部场景准确率验证。
- 暖白纸面、深蓝选中、衬线阅读正文以首稿为视觉基准。使用 react-resizable-panels 负责即时尺寸响应，Motion 负责选中、内容和抽屉过渡，拖拽时不插值宽度，并支持系统减少动效。TXT/Markdown 导入不上传文件，点击 Compare Sources 后才发送编辑区文本，不发送人工标注。
- 云部署尚未完成，Google Cloud Run 仅在评估。不要把 README 的计划、示例或优化建议写成已完成的能力。

## 关键代码定位

| 文件 | 职责 |
| --- | --- |
| `src/components/comparison-workspace.tsx` | 项目和请求控制器、保存、资料修改与分析失效 |
| `src/components/studio-shell.tsx`、`src/components/project-toolbar.tsx` | 常驻框架、导航、搜索入口、项目与导出操作 |
| `src/lib/project-store.ts`、`src/lib/markdown-report.ts` | 本地项目结构与 IndexedDB、完整 Markdown 报告 |
| `src/components/source-panel.tsx`、`src/components/source-reader.tsx` | 资料导入与编辑、全文绘制、页锚、高亮和阅读位置 |
| `src/lib/pdf-import.ts`、`src/components/pdf-import-dialog.tsx` | PDF 页数读取、选页提取、可编辑预览、取消与 Worker 清理 |
| `src/lib/pdf-page-map.ts` | 最终文本页区间、SHA-256 绑定、精确出现位置与页码摘要 |
| `src/lib/project-backup.ts` | 备份格式、核心一致性校验、可选索引容错、恢复命名 |
| `scripts/prepare-pdfjs-assets.mjs` | 从安装包准备 public/pdfjs 下的 Worker/CMap/字体；生成资源不提交 |
| `src/components/findings-panel.tsx` | Workspace 分析摘要与独立计时 / 取消 |
| `src/components/evidence-explorer.tsx`、`src/components/explorer-panels.tsx`、`src/components/source-inspector.tsx` | Findings 导航、证据审阅、布局偏好、抽屉和原文联动 |
| `src/components/confirmation-dialog.tsx` | 可取消的标注保护及现有覆盖 / 删除确认 |
| `src/app/globals.css` | 现有视觉样式与响应式布局 |
| `src/lib/llm.ts` | 服务端供应商调用、提示词、240 秒超时、取消/容量/输出上限错误与最小耗时统计 |
| `src/lib/comparison-schema.ts` | 共享类型、输入限制、五类关系及独立引用校验 |
| `src/app/api/compare/route.ts`、`src/app/api/status/route.ts` | 对照接口与配置存在性检查 |

## 工作方式与必要验证

- 默认单代理，复用现有实现，只完成当前用户任务。不要额外创建需求文档、测试框架、独立复核或治理流程。
- 除用户明确要求外，保持模型、推理参数、提示词、证据校验和服务端架构不变。V0.8 只改变界面与布局偏好，保留 V0.7 的库与 API。复用已保存分析和真实 PDF 做界面检查。
- 文档修改运行 `git diff --check` 并查看差异；应用修改运行 `npm run build`（包含 TypeScript 检查），再实际操作受影响的主流程。已有验证通过后，不重复扩大测试。
- 仅在任务需要验证 AI 时发起真实调用；可复用仍然打开的真实结果页。Try Example 只填虚构资料，不能用模拟发现代替真实调用。
- 真实示例的预期关系：截止日期潜在冲突、个人参赛资格一致、团队资格为 B 的单方信息；判断与原文引用要分别检查。
- `next-env.d.ts` 是已被跟踪的 Next.js 自动生成文件；dev/build 切换可能改变其中的 `.next/types` 与 `.next/dev/types` 引用。先看实际差异，不误当业务修改，不盲目重置已有内容，也不要顺手夹带进无关提交。
- 临时截图、日志、导入样例放在用户指定的临时目录。公开展示素材仅保留必要最终文件，例如 `docs/images/sourcelens-demo.png`。
- 提交时只暂存当前任务的明确文件；按用户授权提交、推送，保留已有历史和其他本地修改。更新 README 时保持开发状态真实，公开文档不加入本机绝对路径。
