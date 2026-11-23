const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');const {boot}=require('./mock.cjs');const folder=path.resolve(__dirname,'../edge-signin-monitor');
test('stale alarm cannot fire a newly edited class reminder early',async()=>{const h=await boot(folder);await h.message({type:'activate'});const when=Date.now()+3600000;h.db.classDue={'class:0':{key:'future',when,classAt:when+1800000,row:{name:'A'}}};await h.run("classReminder('class:0')");assert.equal(h.notes.length,0);assert(!h.db.classSent?.future);assert.equal(h.alarms.get('class:0').when,when);});

test('replanning preserves due alarms for simultaneous classes and restores missing alarms',async()=>{
 const h=await boot(folder);
 let now=Date.parse('2026-11-23T09:20:00+08:00');
 h.c.Date=class extends Date{static now(){return now;}};
 const rows=['A','B'].map(name=>({name,days:[1],time:'10:00',from:'2026-11-23',to:'2026-11-23'}));
 await h.message({type:'activate'});
 await h.message({type:'saveClasses',enabled:true,rows});
 const when=h.db.classDue['class:1'].when;
 const planner=h.alarms.get('class-plan');
 now=when+60000;
 h.alarms.delete('class:0');
 await h.run('planClasses()');
 assert.equal(h.alarms.get('class:0').when,when);
 assert.equal(h.alarms.get('class-plan'),planner);
 await h.run("classReminder('class:0')");
 assert.equal(h.db.classDue['class:1'].when,when);
 await h.run("classReminder('class:1')");
 assert.deepEqual(h.notes.map(note=>note.title),['上课提醒：A','上课提醒：B']);
});
