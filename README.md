# 分区权重记忆

Owner: index.ts, store.mjs, MemoryStore.

这是一个 **Persona 与 Memory（bot）扩展**，基于 Cortico 的 Cormini Persona，并附带其 MIT 授权的基础代码。默认使用通用“记忆助手”，不附带任何个人设定、真实聊天或记忆。

## 安装

需要 Cortico 0.2.2、Node.js 22.16 或更新版本，以及 Git。使用原生 node:sqlite，其他系统尚未实机验证。

在 Cortico 扩展页选择 **Persona / Memory（bot）**，安装 `cortico-bot-weighted-memory@0.2.2`。安装完成后，需要为新部署选择这个 bot；它不能像 World 一样挂到任意现有人格上，也不会自动替换当前 bot。已有本地分区权重记忆使用相同 id `vanilla-memory`，不要同时加载两个实现。

模型连接在部署中配置，自动整理使用该连接并产生模型用量。默认只声明控制台 World，QQ、游戏、直播等 World 按需另外安装。`weightedMemory.contentReviewUrl` 默认留空；需要内容审核时自行配置兼容的本机审核服务。真实记忆仅存入部署目录，不随扩展上传。

迁移现有部署前，先备份 workspace 和一致的 SQLite 数据库。本文中的 CLI 路径均相对于扩展安装目录；迁移命令会修改你指定的数据库，先在备份上演练。

## 功能与数据

### 事件存储

原始输入写入 `raw_messages`，保留消息 ID、正文、作用域、发言者和接收时间。内容审核在后台运行，经过审核的来源按同一会话、运行和15分钟窗口组织为缓冲片段，每片段最多3000字符。窗口只限制来源大小，语义事件由模型按活动、话题、参与者、结束信号与时间判断。同一片段可以产生多个事件，同一批次多个片段可以合为一个事件。

记忆主体可以略过与自己无关的交流；旁观或同处群聊不代表内容与自己有关。在线整理、记忆提交工具和历史摘要均按内容与主体的实际关联判断，不按参与者姓名筛选。整批无相关内容时可返回空数组，不生成候选；原始消息和来源片段保留供追溯。

`memory_candidates` 和 `long_term_memories` 是现有 `records` 表上的视图。全部自动摘要进入 `pending`；审核通过变为 `active`。默认检索和上下文注入只读取已通过的摘要，原始记录和旧档案只供显式 `memory_sources`、控制台和导出追溯。状态还包括 `rejected`、`superseded`、`archived`、`rolled_back`。版本改写保留旧记录，新版本重新进入审核。

`metadata` 保存发生时间 `occurredAt`、时区、时间置信度、原相对时间、来源片段和消息 ID、事件分类、关键事实、人物、地点、结果、情绪、未完成标记、标签和来源类型。无证据的字段为空或 null。`createdAt` 是来源记录时间，不能代替事情发生时间。

相对日期依据各来源消息时间换算；含“上周”等不精确表达时保留“时间不确定”。跨午夜计算使用部署的 UTC+8 时区。其他时区的相对日换算保守返回未知。上下文按当前日期重新渲染，不会把历史“昨天”原样注入。置信度低于0.7时上下文显示时间不确定。迁移资料只有原始正文包含绝对日期时才接受该发生日期，片段头部和文件时间不算发生日期证据。

单消息候选标记为 `single`，`weightedMemory.singleThreshold` 默认8，可设为1–12。低于门槛的候选保留供追溯，后端拒绝实装。现有1–12档位保持兼容，1–9常规档、10–12重大影响档的评分说明保留。权重和可信度是不同字段。

## 一键导出

在“记忆概览 → 快速添加与导出”选择格式和范围，然后点击“一键导出”。每次只生成一个带时间戳的文件，可选“全部资料”或“仅已通过记忆”。

- JSON：有效 JSON 文档，包含格式版本、导出时间、范围和 data 数组；保留记忆记录、元数据与审计，全部资料还包含原始消息、来源索引和迁移索引。
- Markdown（.md）：便于阅读的记忆正文、权重、状态、时间、元数据和审计；全部资料包含原始消息正文。
- SQLite（.sqlite）：可直接用 SQLite 工具打开的独立数据库。全部资料通过在线备份生成一致快照，包含 WAL 中的已提交数据；仅已通过范围只保留已生效长期记忆、其元数据和审计，不带原始消息或待审内容。

导出不修改原数据库，不需要暂停写入。SQLite 在线备份需要 Node.js 22.16 或更新版本。大数据库导出会占用相应内存和临时磁盘空间。
## 控制台接口

现有记忆概览面板使用框架认证和通用面板调用接口，无独立未认证路由。写操作只有控制台操作员可调用，Persona 只声明来源查询和候选提交工具。当前框架为共享控制台密码，审计身份记为 `console-operator`，不区分不同登录者。

- `snapshot(filter, offset, retry, query, kind, sort)`：每页30条，搜索、状态和类型筛选，按 time/weight/confidence/category 排序。
- `detail(id)`：完整摘要、元数据、来源引用、操作记录、完全相同摘要的重复提示。重复提示不替代语义冲突判断。
- `manual(input)`：手工或自然语言内容作为摘要添加为待审。input 包含 text、scope、kind、importance、reason、occurredAt、effectiveAt、tags、sourceType。sourceType 只能为 manual/fabricated。留空时间为未知。不会改写真实来源。
- `correct(id, revision, text, importance, reason, changes)`：编辑后产生待审新版本，原版本变为 superseded。changes 包含 occurredAt 和 tags。
- `review(id, revision, state, reason)`：单条审核，state 为 active/rejected。
- `batchReview(items, state, reason)`：1–50条不同记忆，全部校验版本并在同一事务中通过、拒绝或归档。一条冲突或低权重单句导致整批回滚。
- `restructure(items, parts, reason)`：多条合并或一条拆分，part 为新摘要表单，sourceIds 和 sourceMessageIds 继承原证据，捏造标记继承，结果均待审。被替代的记录保留。时间未知时必须明确留空。
- `rollback(id, revision, reason)`：撤销最近可回滚操作；有后续版本变化时拒绝覆盖。审批和正文修改分别回滚。
- `exportFile(format, approvedOnly)`：下载选定格式；format 为 json / md / sqlite。默认全部资料，范围由界面选择。通过已认证面板的二进制响应下载。
- `exportAll(approvedOnly)`：返回 md/jsonl。默认全部状态，并包含原始消息、来源索引、迁移追溯和审计。
- `importAll(jsonl)`：全量导入，已有同 ID 不覆盖，文本或作用域冲突使整批失败。导入的已生效长期摘要重新待审，已拒绝和旧版本状态保留，原审计保留为导入证据，不能借导入自动生效。大文件使用 CLI，避免控制台请求体上限。

批量合并/拆分输入示例：

```json
[{"text":"游戏输了后停止游戏","kind":"event","importance":5,"occurredAt":null},
 {"text":"用户喜欢红茶","kind":"preference","importance":8,"occurredAt":null}]
```

手工设置 effectiveAt 时，审批后仍要等生效时间才进入检索；捏造记忆在上下文中保留 fabricated 来源标记。没有自动审批、抽样审批或多用户角色系统。

## 迁移和导出

数据库结构在 `MemoryStore` 首次连接时升级，新增 metadata 列及 `migrations/002-event-memory.sql` 中的表、视图和索引。升级是增量操作，不删除旧数据。先使用 SQLite 在线备份或停止所有写入后复制一致数据库，不能仅复制正在使用的 WAL 数据库主文件。

以下命令在扩展安装目录运行，需要 Node.js 22.16 或更新版本。首先对一致备份演练；写生产数据库前停止旧进程。不要用演练库覆盖仍在接收消息的生产库。

```powershell
node event-migrate.mjs status path/to/memory.db
node event-migrate.mjs export path/to/memory.db ./exports/before
node event-migrate.mjs stage path/to/memory.db events-v2 500
```

stage 每次最多500条，重复运行直到 staged=0；允许单批上限5000。全部旧活动或待审条目保留为 archived 并记录原状态，不再参与召回。来源按作用域和原记录时间组织，超过2500字符的旧文本分块保留。每条新来源记录携带 migrationBatch、legacyIds 和原记录引用。重复 stage 不重复归档已登记条目。

```powershell
node --import tsx event-summarize.ts path/to/memory.db path/to/deployment 10
node event-migrate.mjs export path/to/memory.db ./exports/review
node event-migrate.mjs rollback path/to/memory.db events-v2
node event-migrate.mjs import path/to/new.db ./exports/review/all.jsonl
```

离线摘要脚本只使用部署当前模型连接，不启动 bot 或 World。每批同一作用域、最多4个片段和6000字符，串行模型调用；可重复执行继续未完成的来源。请求显式使用 reasoning.effort=none，默认1批，第三个参数控制本次最大批数。输出超限、解析失败、内容审核失败或来源不符时不提交候选、不完成来源。成功批次以 SQLite 事务提交，调用计量保存到 DB.summary.jsonl。已经有外部生成的候选 JSONL 时可使用 `event-migrate.mjs apply DB candidates.jsonl 8`。

全部候选仍需人工审核。迁移回滚恢复原记录状态及处理标记，并把本批新来源和候选停用；已有操作改动了原版本时拒绝回滚。运行时整理器每批最多12个片段、16000字符，最多30个语义事件。积压每分钟继续一批，人工暂停期间停止整理，失败来源重试；超过预算的单条来源保留待人工拆分。原样迁移的大量重复技术档案仍需要模型判断是否有长期价值；不同批次的同一事件可能需要控制台合并。

旧 `migrate.mjs` 只用于首次导入旧 JSON 和工作区，笔记导入后也须审核；存量事件重整使用 event-migrate.mjs。

## 验证

```powershell
node self-check.mjs
npm test
npm run typecheck
npm run build:web
```

自检使用临时真实 SQLite，覆盖游戏和茶事件的精确消息引用、时间锚定、门槛、30条审核的原子性、版本冲突、捏造标记、合并拆分、版本回滚、完整导入导出、重复迁移和迁移回滚。集成测试使用真实 Persona 管线和脚本模型，不访问网络。


## 开发

`npm install`，然后运行 `npm test`、`npm run typecheck` 和 `npm run build:web`。自检使用临时数据库，不启动 bot、不调用云端模型。GitHub 源码与 npm 使用同一份发布产物；上游来源与版权见 THIRD_PARTY_NOTICES.md 和 LICENSE。
