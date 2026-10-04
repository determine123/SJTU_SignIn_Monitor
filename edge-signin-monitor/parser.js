/* Read labelled attendance columns, never arbitrary page numbers. */
(function(root){
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 const ownerOf=table=>table.closest('.el-table__fixed, .el-table__fixed-right')||table.closest('.el-table');
 function parse(doc){
  const tables=[...doc.querySelectorAll('table')];const shared=new Map();const records=[];
  const columnsByTable=new Map();
  for(const table of tables){
   const headings=[...table.querySelectorAll('thead th, thead td')].map(e=>clean(e.textContent));
   const first=table.querySelector('tr');
   const labels=headings.length?headings:[...(first?.querySelectorAll('th,td')||[])].map(e=>clean(e.textContent));
   let map=labels.findIndex(s=>/签到号|签到编号/.test(s));
   const local=map>=0?{num:map,status:labels.findIndex(s=>/状态/.test(s)),time:labels.findIndex(s=>/创建时间|开始时间|发起时间/.test(s))}:null;
   const owner=ownerOf(table);
   if(local){columnsByTable.set(table,local);if(owner)shared.set(owner,local);}
  }
  for(const table of tables){
   // Element UI splits header/body tables, but unrelated widgets must not
   // inherit those labels. Native tables always need their own labels.
   const columns=columnsByTable.get(table)||shared.get(ownerOf(table));if(!columns)continue;
   for(const row of table.querySelectorAll('tbody tr, tr')){
    const cells=[...row.querySelectorAll(':scope > td')].map(e=>clean(e.textContent));
    const num=cells[columns.num];if(!num||!/^\d{1,12}$/.test(num))continue;
    const status=cells[columns.status]||'';const created=cells[columns.time]||'';
    // El-table fixed-column duplicates are deduplicated below.
    records.push({num,status,created,key:num+'|'+created,active:/未签到|签到中|进行中|待签到/.test(status),ended:/已结束|已关闭|已过期/.test(status)});
   }
  }
  const byKey=new Map();
  for(const record of records){
   const previous=byKey.get(record.key);
   // A fixed-column copy may include the number and time but omit status.
   // Do not let that partial duplicate erase a complete attendance record.
   if(!previous||record.status||!previous.status)byKey.set(record.key,record);
  }
  const unique=[...byKey.values()];
  unique.sort((a,b)=>{const ta=Date.parse(a.created.replace(/-/g,'/')),tb=Date.parse(b.created.replace(/-/g,'/'));const validA=Number.isFinite(ta),validB=Number.isFinite(tb);return validA&&validB?tb-ta:validA?-1:validB?1:0;});
  return unique[0]||null;
 }
 root.SigninParser={parse};if(typeof module!=='undefined')module.exports={parse};
})(globalThis);
