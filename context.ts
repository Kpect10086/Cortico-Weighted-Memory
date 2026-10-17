/** Append changes to the delivered history so existing request prefixes remain reusable. */
export class MemoryContext {
  private records: Map<string,string> | null = null;
  private scope = '';
  private hosting = '';
  reset(): void {this.records = null; this.scope = ''; this.hosting = '';}
  update(pack: {intro:string;entries:{id:string;text:string}[]}, scopes:string[], hosting:string): string[] {
    const next = new Map(pack.entries.map(row=>[row.id,row.text]));
    const scope = JSON.stringify(scopes);
    const added = pack.entries.filter(row=>this.records?.get(row.id)!==row.text);
    const removed = [...(this.records?.keys()??[])].filter(id=>!next.has(id));
    const texts:string[] = [];
    if (!this.records || added.length || removed.length || scope!==this.scope) {
      texts.push('[记忆资料更新]\n'+pack.intro+'\n作用域 '+scope+
        '\n新增或更新条目：\n'+added.map(row=>row.text).join('\n')+
        '\n移出本次自动检索视图的条目ID：'+JSON.stringify(removed)+
        '\n移出检索视图不等于否定历史事实。被审核停用或纠正的资料，以最新有效版本和来源为准。');
    }
    if (hosting!==this.hosting) texts.push(hosting);
    this.records=next;this.scope=scope;this.hosting=hosting;
    return texts;
  }
}
