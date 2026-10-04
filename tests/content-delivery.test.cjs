const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

function fixture(failure){
 let reports=0,now=1000;
 const window={};window.top=window;
 const context=vm.createContext({window,location:{href:'https://oc.sjtu.edu.cn/courses/95353/external_tools/6650'},
  document:{documentElement:{},querySelector:()=>null},
  Date:{now:()=>now},JSON,setTimeout:()=>{},clearTimeout:()=>{},setInterval:()=>{},
  MutationObserver:class{observe(){}},SigninParser:{parse:()=>({key:'new-signin',active:true})},
  chrome:{runtime:{sendMessage:async message=>{
   if(message.type==='status')return {active:true};
   reports++;if(reports===1){if(failure==='disconnect')throw Error('worker disconnected');return {ok:false};}
   return {ok:true};
  }}}});
 vm.runInContext(fs.readFileSync(require.resolve('../edge-signin-monitor/content.js'),'utf8'),context);
 return {scan:()=>vm.runInContext('scan()',context),reports:()=>reports,advance:ms=>{now+=ms;}};
}

for(const failure of ['disconnect','rejected'])test(`retry unchanged record after ${failure}, then deduplicate acknowledged reports`,async()=>{
 const f=fixture(failure);
 // Settle the initial scan before simulating the next page mutation.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.reports(),1);
 await f.scan();assert.equal(f.reports(),2);
 await f.scan();assert.equal(f.reports(),2);
 f.advance(20000);await f.scan();assert.equal(f.reports(),3);
});
