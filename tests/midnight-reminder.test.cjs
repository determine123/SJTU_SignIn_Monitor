const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {boot}=require('./mock.cjs');
const folder=path.resolve(__dirname,'../edge-signin-monitor');
const row={name:'跨日课程',courseId:'95353',days:[2],time:'00:10',from:'2026-10-12',to:'2026-10-13',weeks:'all'};
const timestamp=s=>Date.parse(s+'+08:00');

function clock(h,value){let current=value;h.c.Date=class extends Date {static now(){return current;}};return value=>current=value;}

test('a midnight class schedules its reminder on the preceding Shanghai date',async()=>{
 const h=await boot(folder);const S=h.c.ClassSchedule;
 const now=timestamp('2026-10-12T23:35:00');const n=S.next(row,now);
 assert.equal(n.classAt,timestamp('2026-10-13T00:10:00'));
 assert.equal(n.when,timestamp('2026-10-12T23:40:00'));
 assert.equal(n.date,'2026-10-13');
 assert.equal(S.dateOf(now),'2026-10-12');
});

test('waking after the reminder but before midnight class catches up exactly once',async()=>{
 const h=await boot(folder,{classSchedule:[row],classEnabled:true,settings:{enabled:true,sound:false,courses:[]}});
 const advance=clock(h,timestamp('2026-10-12T23:35:00'));
 await h.message({type:'activate'});assert.equal(h.alarms.get('class:0').when,timestamp('2026-10-12T23:40:00'));
 advance(timestamp('2026-10-12T23:55:00'));
 h.events.alarm({name:'class:0'});await h.drain();
 assert.equal(h.notes.length,1);assert.match(h.notes[0].message,/2026-10-13 00:10/);assert.match(h.notes[0].message,/15 分钟后/);
 h.events.alarm({name:'class:0'});await h.drain();
 assert.equal(h.notes.length,1);assert.equal(Object.keys(h.db.classSent).length,1);
});

test('waking at or after class start does not send an obsolete reminder',async()=>{
 for(const time of ['2026-10-13T00:10:00','2026-10-13T00:30:00']){
  const h=await boot(folder,{classSchedule:[row],classEnabled:true,settings:{enabled:true,sound:false,courses:[]}});
  const advance=clock(h,timestamp('2026-10-12T23:35:00'));await h.message({type:'activate'});
  advance(timestamp(time));h.events.alarm({name:'class:0'});await h.drain();
  assert.equal(h.notes.length,0);assert.equal(h.alarms.has('class:0'),false);
 }
});
