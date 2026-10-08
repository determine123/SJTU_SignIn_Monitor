const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const c=vm.createContext({Date});vm.runInContext(fs.readFileSync(path.join(__dirname,'../edge-signin-monitor/schedule.js'),'utf8'),c);
const S=c.ClassSchedule;
test('a term more than two weeks away still schedules its first class',()=>{
 const r=S.validate([{name:'新学期课程',days:[1],time:'08:00',from:'2026-11-02',to:'2026-12-31'}])[0];
 const n=S.next(r,Date.parse('2026-10-08T12:00:00+08:00'));
 assert.equal(n.date,'2026-11-02');
 assert.equal(n.when,Date.parse('2026-11-02T07:30:00+08:00'));
});
test('a future term respects skipped first dates and expired terms stay inactive',()=>{
 const r=S.validate([{name:'新学期课程',days:[1],time:'08:00',from:'2026-11-02',to:'2026-12-31',skipDates:['2026-11-02']}])[0];
 assert.equal(S.next(r,Date.parse('2026-10-08T12:00:00+08:00')).date,'2026-11-09');
 assert.equal(S.next(r,Date.parse('2027-01-01T00:00:00+08:00')),null);
});
