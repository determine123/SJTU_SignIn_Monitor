const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require('./mock.cjs');const folder=path.resolve(__dirname,'../edge-signin-monitor');
async function setup(){
 const date=new Date(Date.now()+3*86400000+8*3600000).toISOString().slice(0,10);
 const rows=[{name:'A',days:[new Date(date+'T00:00:00Z').getUTCDay()||7],time:'14:00',from:date,to:date},{name:'B',days:[new Date(date+'T00:00:00Z').getUTCDay()||7],time:'16:00',from:date,to:date}];
 const key=r=>'lesson:'+r.name+'||'+date+'|'+r.time;
 const pending={[key(rows[0])]:{course:''},[key(rows[1])]:{course:''},'course-1':{course:'1'},test:{course:'1'}};
 const h=await boot(folder,{manualUseConfigured:true,classSchedule:rows,pending});
 h.run("globalThis.cleared=[];globalThis.silenced=0;chrome.notifications.clear=async id=>cleared.push(id);chrome.offscreen.hasDocument=async()=>true;chrome.runtime.sendMessage=async m=>{if(m.type==='silence')silenced++;return {ok:true}}");
 return {h,rows,key};
}
test('removing a lesson clears its pending alert and preserves unrelated alerts',async()=>{
 const {h,rows,key}=await setup();assert.equal((await h.message({type:'removeClass',index:0,row:rows[0]})).ok,true);
 assert(!h.db.pending[key(rows[0])]);assert(h.db.pending[key(rows[1])]);assert(h.db.pending['course-1']);assert(h.db.pending.test);assert.equal(h.c.silenced,0);
});
test('disabling class reminders clears lesson alerts only',async()=>{
 const {h,rows,key}=await setup();assert.equal((await h.message({type:'saveClasses',rows,enabled:false})).ok,true);
 assert(!h.db.pending[key(rows[0])]);assert(!h.db.pending[key(rows[1])]);assert(h.db.pending['course-1']);assert(h.db.pending.test);
});
test('removing the last pending lesson stops the sound',async()=>{
 const {h,rows,key}=await setup();h.db.pending={[key(rows[0])]:{course:''}};
 await h.message({type:'removeClass',index:0,row:rows[0]});assert.equal(Object.keys(h.db.pending).length,0);assert.equal(h.c.silenced,1);
});
test('saving unchanged lessons preserves pending reminders',async()=>{
 const {h,rows,key}=await setup();await h.message({type:'saveClasses',rows,enabled:true});
 assert(h.db.pending[key(rows[0])]);assert(h.db.pending[key(rows[1])]);assert.equal(h.c.cleared.length,0);
});
test('adding a skipped date clears only the affected occurrence',async()=>{
 const {h,rows,key}=await setup();const changed=rows.map(r=>({...r}));changed[0].skipDates=[rows[0].from];
 await h.message({type:'saveClasses',rows:changed,enabled:true});assert(!h.db.pending[key(rows[0])]);assert(h.db.pending[key(rows[1])]);
});
test('lesson names containing pipes retain valid pending alerts',async()=>{
 const {h,rows,key}=await setup();rows[0].name='A|seminar';h.db.pending={[key(rows[0])]:{course:''}};
 await h.message({type:'saveClasses',rows,enabled:true});assert(h.db.pending[key(rows[0])]);assert.equal(h.c.cleared.length,0);
});
