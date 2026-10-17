import base from './base/webui/client.ts';
import type { WebUiClientBundle } from 'cortico/web/shared/client-panel.ts';

type Memory = { id: string; scope: string; text: string; kind: string; importance: number; reason: string; source: string; createdAt: number; state: string; revision: string; reviewError?: boolean; reviewPending?: boolean; metadata:string };
type Detail = Memory & { audit: Array<{ at: number; operation: string; detail: string }> };
type Snapshot = {
  total: number; chars: number; records: number; limit: number; matched: number;
  pendingSummary: number; oldestPendingAt: number | null;
  kinds: Array<{ kind: string; state: string; count: number }>;
  rows: Memory[];
};
const kinds: Record<string, string> = { core: '核心', archive: '旧档案', raw: '原始事件', fact: '事实', preference: '偏好', relation: '关系', commitment: '约定', recent: '近期', event:'事件', single:'高权重单句' };
const states: Record<string, string> = { active: '生效', pending: '待审核', rejected: '已停用', superseded: '已替代', archived:'已归档', rolled_back:'已回滚' };

const bundle: WebUiClientBundle = { panels: { ...base.panels,
  'weighted-memory': { mount(ctx) {
    const { ui, root } = ctx;
    const controls = ui.rowbar();
    const filter = ui.select({ value: 'memories', options: [
      { value: 'memories', label: '提炼后的记忆' }, { value: 'pending', label: '待审核' },
      { value: 'core', label: '核心' }, { value: 'rejected', label: '已停用 / 旧版本' },
      {value:'archived',label:'已归档'}, { value: 'raw', label: '原始事件' }, { value: 'archive', label: '旧档案' }, { value: 'all', label: '全部资料' },
    ] });
    const search=ui.input({placeholder:'搜索摘要或 ID'});
    const kind=ui.select({value:'',options:[{value:'',label:'所有类型'},...Object.entries(kinds).map(([value,label])=>({value,label}))]});
    const sort=ui.select({value:'time',options:[{value:'time',label:'时间排序'},{value:'weight',label:'权重排序'},{value:'confidence',label:'时间置信度排序'},{value:'category',label:'事件分组'}]});
    const selected=new Map<string,string>();
    const bulkReason=ui.input({placeholder:'批量操作理由'});bulkReason.maxLength=500;
    const bulk=ui.actions();
    const manage=ui.sheet({title:'快速添加与导出'});
    const manualText=ui.textarea({rows:3});manualText.maxLength=1500;
    const scope=ui.input({value:'main'});
    const manualKind=ui.select({value:'event',options:Object.entries(kinds).filter(([value])=>['event','single','preference','relation','commitment','core'].includes(value)).map(([value,label])=>({value,label}))});
    const sourceType=ui.select({value:'manual',options:[{value:'manual',label:'手工录入'},{value:'fabricated',label:'捏造记忆'}]});
    const at=ui.input({placeholder:'发生时间 ISO，例如 2026-10-13T20:10:00+08:00；留空表示未知'});
    const effective=ui.input({placeholder:'生效时间 ISO；留空为审核后生效'});
    const weight=ui.input({type:'number',value:'8'});weight.min='1';weight.max='12';weight.step='1';
    const manualReason=ui.input({placeholder:'添加理由'});manualReason.maxLength=500;
    const tags=ui.input({placeholder:'标签，用逗号分隔'});
    const transfer=ui.textarea({rows:3});transfer.placeholder='导入 all.jsonl 或合并/拆分后的 JSON 数组';
    const manageActions=ui.actions();
    manage.body.append(ui.field('记忆摘要或自然语言内容',manualText),ui.field('作用域',scope),ui.field('类型',manualKind),ui.field('来源',sourceType),ui.field('发生时间',at),ui.field('生效时间',effective),ui.field('权重',weight),ui.field('标签',tags),ui.field('添加理由',manualReason),manageActions,ui.field('导入或批量合并拆分内容',transfer));
    const download=(name:string,text:string)=>{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=ui.h('a') as HTMLAnchorElement;link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    const body = ui.h('div');
    const error = ui.msgline();
    const page = ui.msgline();
    let request = 0, offset = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    ctx.signal.addEventListener('abort', () => clearTimeout(refreshTimer), { once: true });
    body.addEventListener('input', () => clearTimeout(refreshTimer), { signal: ctx.signal });
    body.addEventListener('click', () => clearTimeout(refreshTimer), { signal: ctx.signal });
    const previous = ui.button('上一页', { onClick: () => { offset = Math.max(0, offset - 30); void reload(); } });
    const next = ui.button('下一页', { onClick: () => { offset += 30; void reload(); } });
    const reload = async (retry = false) => {
      clearTimeout(refreshTimer);
      if (ctx.signal.aborted) return;
      const current = ++request;
      try {
        const data = await ctx.invoke<Snapshot>('snapshot', [filter.value, offset, retry,search.value,kind.value,sort.value]);
        if (ctx.signal.aborted || current !== request) return;
        if (offset > 0 && offset >= data.matched) { offset = Math.max(0, offset - 30); return void reload(); }
        error.textContent = '';selected.clear();
        previous.disabled = offset === 0;
        next.disabled = offset + 30 >= data.matched;
        page.textContent = `${data.matched ? offset + 1 : 0}–${Math.min(offset + 30, data.matched)} / ${data.matched} 条`;
        const overview = ui.sheet({ title: '分区权重记忆', desc: '长期检索只读取已通过记忆。候选均待人工审核，单句权重须达到配置门槛。每页30条。原始资料保留用于追溯。' });
        overview.body.append(ui.kv([
          { k: '资料总数', v: String(data.total) },
          { k: '待整理原始事件', v: String(data.pendingSummary) },
          { k: '最早待整理来源时间', v: data.oldestPendingAt === null ? '无积压' : new Date(data.oldestPendingAt).toLocaleString() },
          { k: '本次注入', v: `${data.records} 条 / ${data.chars} 字符，上限 ${data.limit}` },
          ...data.kinds.map(row => ({ k: `${kinds[row.kind] ?? row.kind} · ${states[row.state] ?? row.state}`, v: String(row.count) })),
        ]));
        const cards = data.rows.map(row => {
          const meta=JSON.parse(row.metadata || '{}');
          const select=ui.checkbox('选择记忆',{onChange:checked=>{if(checked)selected.set(row.id,row.revision);else selected.delete(row.id);}});
          const card = ui.sheet({ title: `${meta.category ?? ''} · ${kinds[row.kind] ?? row.kind} · ${states[row.state] ?? row.state} · ${row.importance >= 10 ? '非常规' : '常规'}档 ${row.importance}`, desc: `发生时间 ${meta.occurredAt ?? '时间不确定'} · ${meta.sourceType ?? '旧资料'} · ${row.scope}` });
          const preview = ui.h('pre', null, row.text);
          preview.style.whiteSpace = 'pre-wrap';
          const actions = ui.actions(), editor = ui.h('div'), notice = ui.msgline();
          const reason = ui.input({ placeholder: row.importance >= 10 ? '重大影响及选档理由（必填）' : '审核或纠错理由（必填）' });
          reason.maxLength = 500;
          reason.required = true;
          const run = async (method: string, args: unknown[]) => {
            if (!reason.value.trim()) { notice.textContent = '请填写操作理由（1–500字符）'; reason.focus(); return; }
            const buttons = [...actions.querySelectorAll('button'), ...editor.querySelectorAll('button')];
            buttons.forEach(button => { button.disabled = true; });
            try { await ctx.invoke(method, args); if (!ctx.signal.aborted) await reload(); }
            catch (failure) { if (!ctx.signal.aborted) notice.textContent = `操作失败：${String(failure)}`; }
            finally { buttons.forEach(button => { button.disabled = false; }); }
          };
          const show = async (editing: boolean) => {
            try {
              const detail = await ctx.invoke<Detail>('detail', [row.id]);
              if (ctx.signal.aborted || current !== request) return;
              editor.replaceChildren();
              const text = ui.textarea({ value: detail.text, rows: 6 });
              text.readOnly = !editing;
              const weight = ui.input({ value: String(detail.importance), type: 'number' });
              weight.min = '1'; weight.max = '12'; weight.step = '1'; weight.required = true;
              const detailMeta=JSON.parse(detail.metadata || '{}');
              const occurred=ui.input({value:detailMeta.occurredAt ?? '',placeholder:'带时区 ISO；留空为未知'});
              const editTags=ui.input({value:(detailMeta.tags ?? []).join(',')});
              const buttons = ui.actions();
              if (editing) {
                text.maxLength = 1500;
                buttons.append(ui.button('保存纠错', { variant: 'primary', onClick: () => {
                  if (!weight.reportValidity()) return;
                  void run('correct', [detail.id, detail.revision, text.value, Number(weight.value), reason.value,{occurredAt:occurred.value.trim() || null,tags:editTags.value.split(/[,，]/).map(t=>t.trim()).filter(Boolean)}]);
                } }));
              }
              buttons.append(ui.button('关闭', { onClick: () => { editor.replaceChildren(); } }));
              editor.append(ui.field(editing ? '纠正后的正文' : '完整原文', text));
              if (editing) editor.append(ui.field('发生时间',occurred),ui.field('标签',editTags),ui.field('权重（1–12；1–9 常规，10–12 仅重大事情）', weight));
              editor.append(ui.kv((detail as Detail & {conflicts?:Array<{id:string;state:string}>}).conflicts?.map(r=>({k:'相同摘要候选',v:r.id+' · '+r.state})) ?? []));
              editor.append(ui.kv(detail.audit.map(entry => ({ k: `${new Date(entry.at).toLocaleString()} · ${entry.operation}`, v: entry.detail }))), buttons);
            } catch (failure) { if (!ctx.signal.aborted && current === request) notice.textContent = `读取详情失败：${String(failure)}`; }
          };
          actions.append(ui.button('回滚最近操作',{onClick:()=>{void run('rollback',[row.id,row.revision,reason.value]);}}));
          actions.append(ui.button('原文 / 操作记录', { onClick: () => { void show(false); } }));
          if (row.state !== 'superseded') {
            if (!['raw', 'archive'].includes(row.kind)) actions.append(ui.button('纠错 / 调整权重', { onClick: () => { void show(true); } }));
            if (row.state !== 'active' && !['raw','archive'].includes(row.kind)) actions.append(ui.button(row.state === 'pending' ? (row.importance >= 10 ? '通过非常规档位' : '通过') : '恢复', { onClick: () => { void run('review', [row.id, row.revision, 'active', reason.value]); } }));
            if (row.state !== 'rejected') actions.append(ui.button(row.state === 'pending' ? '拒绝' : '停用', { variant: 'danger', onClick: () => { void run('review', [row.id, row.revision, 'rejected', reason.value]); } }));
          }
          card.body.append(select.el,preview, ui.kv([{ k: '保留理由', v: row.reason }, { k: '来源 / 前一版本', v: row.source }, { k: '记录 ID', v: row.id }]), ui.field('操作理由', reason), actions, notice, editor);
          return card.el;
        });
        body.replaceChildren(overview.el, ...cards);
        if (data.rows.some(row => row.reviewPending)) refreshTimer = setTimeout(() => { void reload(); }, 3000);
      } catch (failure) {
        if (!ctx.signal.aborted && current === request) error.textContent = `读取记忆失败：${String(failure)}`;
      }
    };
    const perform=async(method:string,args:unknown[])=>{try{await ctx.invoke(method,args);if(!ctx.signal.aborted)await reload();}catch(failure){error.textContent=String(failure);}};
    const items=()=>[...selected].map(([id,revision])=>({id,revision}));
    for(const [state,label] of [['active','批量通过'],['rejected','批量拒绝'],['archived','批量归档']]) bulk.append(ui.button(label,{onClick:()=>{void perform('batchReview',[items(),state,bulkReason.value]);}}));
    bulk.append(ui.button('全选当前页',{onClick:()=>{body.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(input=>{input.checked=true;input.dispatchEvent(new Event('change'));});}}),ui.button('提交合并 / 拆分',{onClick:()=>{try{void perform('restructure',[items(),JSON.parse(transfer.value),bulkReason.value]);}catch(failure){error.textContent=String(failure);}}}));
    manageActions.append(ui.button('添加为待审',{onClick:()=>{if(!weight.reportValidity())return;void perform('manual',[{text:manualText.value,scope:scope.value,kind:manualKind.value,sourceType:sourceType.value,occurredAt:at.value.trim() || null,effectiveAt:effective.value.trim() || null,importance:Number(weight.value),reason:manualReason.value,tags:tags.value.split(/[,，]/).map(t=>t.trim()).filter(Boolean)}]);}}),ui.button('导出全部 all',{onClick:()=>{void ctx.invoke<{md:string;jsonl:string}>('exportAll',[false]).then(data=>{download('all.md',data.md);download('all.jsonl',data.jsonl);}).catch(failure=>{error.textContent=String(failure);});}}),ui.button('导出已通过',{onClick:()=>{void ctx.invoke<{md:string;jsonl:string}>('exportAll',[true]).then(data=>{download('all-approved.md',data.md);download('all-approved.jsonl',data.jsonl);}).catch(failure=>{error.textContent=String(failure);});}}),ui.button('导入为待审',{onClick:()=>{void perform('importAll',[transfer.value]);}}));
    controls.append(search,kind,sort,filter, ui.button('刷新', { onClick: () => { void reload(true); } }), previous, next, page);
    filter.addEventListener('change', () => { offset = 0; void reload(); }, { signal: ctx.signal });
    for(const input of [kind,sort]) input.addEventListener('change',()=>{offset=0;void reload();},{signal:ctx.signal});
    search.addEventListener('change',()=>{offset=0;void reload();},{signal:ctx.signal});
    root.append(controls,bulkReason,bulk,manage.el,error,body);
    void reload();
  } },
} };
export default bundle;
