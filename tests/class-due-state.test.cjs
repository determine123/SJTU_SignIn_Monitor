const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require('./mock.cjs');
const folder=path.resolve(__dirname,'../edge-signin-monitor');
function lesson(){const d=new Date(Date.now()+3*86400000+8*3600000);const date=d.toISOString().slice(0,10);return {name:'待上课程',days:[d.getUTCDay()||7],time:'14:00',from:date,to:date};}
test('disabling class reminders clears displayed due times and enabling replans them',async()=>{
 const row=lesson(),h=await boot(folder,{classSchedule:[row]});
 await h.message({type:'activate'});assert(h.db.classDue['class:0']);
 await h.message({type:'saveClasses',rows:[row],enabled:false});
 assert(!h.alarms.has('class:0'));assert.equal(Object.keys(h.db.classDue).length,0);
 await h.message({type:'saveClasses',rows:[row],enabled:true});
 assert(h.alarms.has('class:0'));assert(h.db.classDue['class:0']);
});
test('browser restart clears stale due times until the extension is activated again',async()=>{
 const row=lesson(),h=await boot(folder,{classSchedule:[row]});
 await h.message({type:'activate'});assert(h.db.classDue['class:0']);
 h.events.startup();await h.drain();
 assert(!h.alarms.has('class:0'));assert.equal(Object.keys(h.db.classDue).length,0);
 assert.equal(h.db.classSchedule[0].name,row.name);
 await h.message({type:'activate'});assert(h.db.classDue['class:0']);
});
