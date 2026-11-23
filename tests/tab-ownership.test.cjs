const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');const {boot}=require('./mock.cjs');const folder=path.resolve(__dirname,'../edge-signin-monitor');
test('a reused tab is never navigated away from another site',async()=>{const h=await boot(folder,{settings:{courses:['123']},states:{123:{tabId:7}}});h.tabs.push({id:7,url:'https://example.org/work',status:'complete'});await h.message({type:'activate'});assert.equal(h.tabs[0].url,'https://example.org/work');assert.equal(h.tabs.length,2);assert.equal(h.db.states['123'].tabId,101);});

test('only the configured Canvas tool accepts attendance reports, while campus login preserves the baseline',async()=>{
 const baseline={key:'old',num:'1234'};
 const h=await boot(folder,{manualUseConfigured:true,settings:{courses:['123'],sound:false},states:{123:{tabId:7,record:baseline}}});
 const tab={id:7,url:'https://oc.sjtu.edu.cn/courses/123/external_tools/6650?display=borderless#tool',status:'complete'};
 h.tabs.push(tab);
 await h.message({type:'activate'});
 assert.equal(h.tabs.length,1);
 const record={key:'new',num:'5678',active:true};
 tab.url='https://example.org/courses/123/external_tools/6650';
 await h.message({type:'report',record,top:true},{tab});
 assert.deepEqual(h.db.states['123'].record,baseline);
 tab.url='https://jaccount.sjtu.edu.cn/jaccount/jalogin';
 await h.message({type:'report',record,top:true},{tab});
 assert.deepEqual(h.db.states['123'].record,baseline);
 assert.equal(h.db.states['123'].status,'需要登录');
 tab.url='https://oc.sjtu.edu.cn/courses/123/external_tools/6650';
 await h.message({type:'report',record,top:false},{tab});
 assert.deepEqual(h.db.states['123'].record,record);
 assert.equal(h.notes.length,1);
});
