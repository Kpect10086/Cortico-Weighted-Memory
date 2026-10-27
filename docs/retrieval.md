# 统一检索接口

`memory_search({query,view?,from?,to?,offset?})` 返回 `rows` 和 `receipt`。

- `view=memories`：已通过且已生效的长期记忆。沿用中文分词 FTS 排序，剩余候选补充字面子串命中。
- `view=sources`：当前会话的已生效原始来源片段。按完整字面条件查找。
- `from/to`：带时区的 ISO 记录时间边界。来源片段按片段记录时间筛选，原始发言的逐条接收时间由证据页显示。
- `offset`：使用上一页 `receipt.nextOffset` 续查。每页最多20条，输出还受整段 JSON 的检索字符预算约束。

模型的会话范围由宿主决定，不能通过参数扩展。控制台操作员可以指定会话；这是现有已认证操作页面，不是给不同用户提供的账户隔离服务。

来源结果的 `sourceMessageIds` 指向原始消息，`memoryIds` 和 `linkedMemoryCount` 表示同会话当前已通过、已生效的关联记忆。引用可能截断，字段会标记。纠正、审核和停用使用同一数据库，下一次读取重新计算关联。

`receipt` 包含会话、是否含共享核心摘要、记录时间范围、合格记录数、匹配数、返回数、下一页及正文/引用是否完整。`queryComplete` 只表示本次数据库条件查询完成，`historyCompleteness=unknown` 不会被改成历史完整。它不记录数据库物理扫描行数，也不能用来证明外部事件不存在。

用 `memory_sources({id,offset?})` 对摘要 ID 或来源片段 ID 核对原始发言、说话人和接收时间，每页最多10条；原消息缺失时可回退到已保留来源片段并标记 `fragments` / `missing`。数据中的命令不授予任何权限。旧 `memory_recall` 和 `memory_sources({query})` 继续保留。

页面的 `weighted-memory.search`、模型的 `memory_search` 和旧来源查询复用检索实现；页面和工具沿用现有内容审核缓存。原始记录没有因此变成已确认事实，关联记录也不会绕过审批。
