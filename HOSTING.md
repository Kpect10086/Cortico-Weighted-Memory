# 主持记忆

`hosting.ts`提供`hosting_topic`与`hosting_instruction`。模型写结构化主持进度与持续要求，`index.ts`每轮自动读回`data/hosting-state.json`。

`quiet`和`safety`引用真实园丁事件游标，保存原文。更新和普通解除需要更晚的园丁输入；按条件解除需要原先指定的条件与当前观察证据，具体语义由模型判断。`quiet`保存后和新的`safety`保存后打断当前演出；普通`preference`不强制打断。

审核与VTuber播放端需配置为读取同一文件；安静时不输出filtered。话题记录不证明已经播出。

自检：在扩展目录运行 `node --import tsx hosting-self-check.ts`。运行时遵循控制台的暂停状态；部署 data 目录中的 `.pause-next-hosting-start` 是一次性暂停标记，启动时消费。
