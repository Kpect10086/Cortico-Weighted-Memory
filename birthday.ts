export function birthdayContext(constitution:string,now:Date,timezone:string):string {
  const birth=/操作员的生日是(\d{4})-(\d{2})-(\d{2})/.exec(constitution);
  if(!birth)return '';
  const [year,month,day]=new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now).split('-').map(Number);
  const age=year-Number(birth[1])-(month*100+day<Number(birth[2])*100+Number(birth[3])?1:0);
  return `操作员当前周岁为${age}岁，按受保护资料中的生日与当前本地日期计算；生日属于私人资料，不主动向外披露。`;
}
