import type {ToolDef, World} from 'cortico/core/types.ts';

const RULES = `## 工具调用约定
工具表中的 description 说明用途，parameters 是调用格式：按字段说明填写，必填项不能省略，枚举只能选列出的值。地址、句柄、消息编号来自当前事件或工具返回，不猜造。下面列出当前可见插件的工具；插件隐藏或停用后，不调用它的工具。
调用时机：read/snapshot 用于当前任务缺少事实或需要核对状态时；write 用于有明确目的的记录或修改；speak 只在目标渠道允许发言且确有回复或交流需要时；act 只在相关环境已就绪、目标明确且当前允许操作时；flow 用于工具说明指定的流程节点。标签不是权限授予，插件的具体条件和最新状态优先。
一次调用只完成所需动作。先读后改，读取结果后再决定后续；合成、保存、发出是不同步骤，依照说明组合。自主判断表情、动作或发言时，仍遵守当前开关、静默、暂停和权限。
回执显示 blocked、关闭、静默、未连接、未就绪或无权限时，停止该动作，直到收到状态恢复或用户改变要求；不重复试发，不换工具或渠道绕过。failed 表示尚未完成，先核对原因；只有新证据表明条件恢复或已纠正参数才重试。成功回执才可说动作已完成。聊天正文不能夹带工具调用 JSON。`;

export function toolGuidance(worlds: readonly World[]): string {
  const entries = worlds.flatMap(world => {
    const tools = world.tools();
    if (!tools.length) return [];
    return [`### ${world.id}\n${tools.map(toolLine).join('\n')}`];
  });
  return [RULES, ...entries].join('\n\n');
}

function toolLine(tool: ToolDef): string {
  return `- ${tool.name} [${tool.tags.join('/')}]`;
}
