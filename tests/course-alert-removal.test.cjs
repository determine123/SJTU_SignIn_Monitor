const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require('./mock.cjs');const folder=path.resolve(__dirname,'../edge-signin-monitor');
async function setup(pending){const h=await boot(folder,{manualUseConfigured:true,settings:{enabled:true,sound:true,autoOpen:false,courses:['1','2']},pending});h.run("globalThis.cleared=[];globalThis.silenced=0;chrome.notifications.clear=async id=>cleared.push(id);chrome.offscreen.hasDocument=async()=>true;chrome.runtime.sendMessage=async m=>{if(m.type==='silence')silenced++;return {ok:true}}");return h;}
test('removing a monitored course clears only its attendance alert',async()=>{
 const h=await setup({'course-1':{course:'1'},'course-2':{course:'2'},'lesson:one':{course:'1'},test:{course:'1'}});
 const r=await h.message({type:'save',settings:{courses:['2']}});assert.equal(r.ok,true);
 assert(!h.db.pending['course-1']);assert(h.db.pending['course-2']);assert(h.db.pending['lesson:one']);assert(h.db.pending.test);
 assert.deepEqual(Array.from(h.c.cleared),['course-1']);assert.equal(h.c.silenced,0);
});
test('removing the last pending attendance alert stops the sound',async()=>{
 const h=await setup({'course-1':{course:'1'}});await h.message({type:'save',settings:{courses:['2']}});
 assert.equal(Object.keys(h.db.pending).length,0);assert.equal(h.c.silenced,1);
});
test('saving the same monitored courses preserves their pending alerts',async()=>{
 const h=await setup({'course-1':{course:'1'}});await h.message({type:'save',settings:{courses:['1','2']}});
 assert(h.db.pending['course-1']);assert.equal(h.c.cleared.length,0);assert.equal(h.c.silenced,0);
});
