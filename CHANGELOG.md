# Changelog

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
