const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('../edge-signin-monitor/parser.js');

// Small DOM doubles keep parsing unit tests independent of a browser install.
const cells=values=>values.map(textContent=>({textContent}));
function table(headers,rows,owner=null,fixed=null){
 const headings=cells(headers);
 const body=rows.map(values=>({querySelectorAll:selector=>selector===':scope > td'?cells(values):[]}));
 return {
  closest:selector=>selector==='.el-table__fixed, .el-table__fixed-right'?fixed:owner,
  querySelector:()=>headers.length?{querySelectorAll:()=>headings}:body[0],
  querySelectorAll:selector=>selector==='thead th, thead td'?headings:selector==='tbody tr, tr'?body:[],
 };
}
const documentOf=(...tables)=>({querySelectorAll:()=>tables});
const labels=['签到号','状态','创建时间'];
const attendance=['1234','签到中','2026-10-04 08:00:00'];

for(const partialFirst of [true,false])test(`a duplicate without status cannot erase an active record (partial first: ${partialFirst})`,()=>{
 const complete=table(labels,[attendance]);
 const partial=table(['签到号','创建时间'],[['1234',attendance[2]]]);
 const record=parse(documentOf(...(partialFirst?[partial,complete]:[complete,partial])));
 assert.equal(record.status,'签到中');assert.equal(record.active,true);
});

test('an ended record remains ended when a partial duplicate follows it',()=>{
 const record=parse(documentOf(table(labels,[['1234','已结束',attendance[2]]]),table(['签到号','创建时间'],[['1234',attendance[2]]])));
 assert.equal(record.ended,true);assert.equal(record.active,false);
});

test('an unrelated table cannot inherit attendance columns',()=>{
 const doc=documentOf(table(labels,[attendance]),table(['学号','备注','时间'],[['9999','待签到','2026-10-04 09:00:00']]));
 assert.equal(parse(doc).num,'1234');
});
test('a headerless unrelated table cannot inherit attendance columns',()=>{
 const doc=documentOf(table(labels,[attendance]),table([], [['9999','签到中','2026-10-04 09:00:00']]));
 assert.equal(parse(doc).num,'1234');
});
test('split Element tables share columns only within the same widget',()=>{
 const owner={};const other={};
 const doc=documentOf(table(labels,[],owner),table([], [attendance],owner),table([], [['9999','签到中','2026-10-04 09:00:00']],other));
 assert.equal(parse(doc).num,'1234');
});
test('independent attendance widgets retain their own column order',()=>{
 const first={},second={};
 const doc=documentOf(table(labels,[],first),table(['状态','创建时间','签到编号'],[],second),table([], [attendance],first),table([], [['待签到','2026-10-04 10:00:00','5678']],second));
 const record=parse(doc);
 assert.equal(record.num,'5678');assert.equal(record.active,true);
});

test('a partial fixed-column header cannot overwrite the main table mapping',()=>{
 const owner={},fixed={};
 const doc=documentOf(table(labels,[],owner),table(['签到号'],[],owner,fixed),table([], [attendance],owner),table([], [['1234']],owner,fixed));
 const record=parse(doc);
 assert.equal(record.num,'1234');
 assert.equal(record.created,'2026-10-04 08:00:00');
 assert.equal(record.status,'签到中');
 assert.equal(record.active,true);
});

test('a fixed-column copy appearing first cannot hide the dated main record',()=>{
 const owner={},fixed={};
 const doc=documentOf(table(['签到号'],[],owner,fixed),table([], [['1234']],owner,fixed),table(labels,[],owner),table([], [attendance],owner));
 const record=parse(doc);
 assert.equal(record.created,'2026-10-04 08:00:00');
 assert.equal(record.active,true);
});
