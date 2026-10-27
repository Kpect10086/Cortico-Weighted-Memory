# Changelog

## 0.2.6 — 2026-10-27

- 显示名称改为“权重检索”，原包名、数据位置和配置键保持兼容。
- 新增统一检索入口，可分页查已通过记忆和来源片段，并按记录时间缩小范围。
- 来源可反查当前已通过的关联记忆，摘要和来源均可核对原始说话人与接收时间。
- 页面检索与原有审核、纠正、停用和排序联动，共用同一数据库。
- 返回查询范围、候选数、分页与截断说明；未命中不表示事情从未发生。
- 保留 0.2.5 的跨平台路径、导入和工作区边界修复。
- 重写面向普通用户的说明，解释权重、两种审核、原始记录保留和训练素材授权。

## 0.2.5 — 2026-10-24

- 修复跨平台路径、数据边界与回归验证；支持 Linux 与 Windows。

## 0.2.4

- 同步上下文连续性、分区预算、审核导出与受保护资料编辑的最新修复。
- 补充生日上下文和记忆管理能力，公开副本使用通用操作员资料。

## 0.2.3

- 更新事件来源与人物归属、增量上下文、摘要队列和审核开关。
- 支持受保护身份资料编辑、后台草稿认知、普通候选自动通过及完整导出。
- 同步 Cortico 0.2.4 基础 Persona，自带 WebUI；发布包移除私人资料。

## 0.2.2

- One-click export with JSON, Markdown and SQLite format selection; downloads one timestamped file.
- All-data and approved-memory scopes, complete metadata and audit retention, consistent online SQLite snapshots.
- Export progress/error states and duplicate-click prevention. Requires Node.js >=22.16.0 for the SQLite backup API.

## 0.2.1

- First public release, packaged as a bot extension with the bundled Cormini base Persona.
- Weighted scope budgets, evidence-based event summaries, manual approval, merge/split, revision checks, rollback and export/import.
- Current bot v7 contract, WebUI bundle and package self-description.
- Optional content-review service; no private Memory or deployment data included.
