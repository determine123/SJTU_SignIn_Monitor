const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {boot}=require('./mock.cjs');
const folder=path.resolve(__dirname,'../edge-signin-monitor');

test('a closed tab during reload does not prevent other courses from being polled',async()=>{
 const h=await boot(folder,{manualUseConfigured:true,settings:{enabled:true,courses:['123','456'],sound:false},states:{123:{tabId:7,opened:1}}});
 h.session.activated=true;
 h.tabs.push({id:7,url:'https://oc.sjtu.edu.cn/courses/123/external_tools/6650',status:'complete'});
 h.c.chrome.tabs.reload=async()=>{throw Error('No tab with id: 7');};
 await h.run('tick()');
 assert.equal(h.tabs.length,2);
 assert.equal(h.db.states['456'].tabId,101);
 assert.match(h.db.states['123'].status,/失败/);
 assert(h.db.logs.some(log=>log.course==='123'&&log.kind==='error'));
});

test('a failed tab creation preserves the existing baseline and continues polling',async()=>{
 const record={key:'existing',num:'1234'};
 const h=await boot(folder,{manualUseConfigured:true,settings:{enabled:true,courses:['123','456'],sound:false},states:{123:{record}}});
 h.session.activated=true;
 const create=h.c.chrome.tabs.create;
 h.c.chrome.tabs.create=async options=>{
  if(options.url.includes('/123/'))throw Error('Creation failed');
  return create(options);
 };
 await h.run('tick()');
 assert.deepEqual(h.db.states['123'].record,record);
 assert.equal(h.db.states['456'].tabId,100);
});
