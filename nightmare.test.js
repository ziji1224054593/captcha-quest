import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {setMaxListeners} from 'node:events';

// DOM/canvas doubles exercise pointer lifecycle without exposing answers in the public API.
function environment(){
  // A component intentionally binds more than ten DOM listeners to one cleanup signal.
  class DOMAbortController extends AbortController {constructor(){super();setMaxListeners(20,this.signal);}}
  const frames=new Map();let frameId=0;
  const context=new Proxy({}, {get(t,k){return t[k]||(k==='isPointInPath'?(_,x,y)=>Math.abs(x)<43&&Math.abs(y)<43:(k==='createLinearGradient'||k==='createRadialGradient')?()=>({addColorStop(){}}):()=>{});},set(t,k,v){t[k]=v;return true;}});
  class Element extends EventTarget {
    constructor(){super();this.style={};this.children=[];this.classList={toggle(){}};this.textContent='';this.hidden=false;this.capture=null;}
    appendChild(child){this.children.push(child);child.parent=this;return child;}
    remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
    attachShadow(){this.shadowRoot=new Root();return this.shadowRoot;}
    getContext(){return context;}
    getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
    setPointerCapture(id){this.capture=id;}
    hasPointerCapture(id){return this.capture===id;}
    releasePointerCapture(){this.capture=null;this.dispatchEvent(new Event('lostpointercapture'));}
  }
  class Root {constructor(){this.elements=new Map();}getElementById(id){if(!this.elements.has(id))this.elements.set(id,new Element());return this.elements.get(id);}querySelector(s){return this.getElementById(s.slice(1));}}
  const document=new Element();document.createElement=()=>new Element();document.hidden=false;
  const window=new Element();
  const sandbox={document,window,crypto:webcrypto,AbortController:DOMAbortController,CustomEvent,Uint32Array,Path2D:class{moveTo(){}lineTo(){}bezierCurveTo(){}closePath(){}},requestAnimationFrame(f){const id=++frameId;frames.set(id,f);return id;},cancelAnimationFrame(id){frames.delete(id);}};
  const source=readFileSync(new URL('./vendor/captcha.js',import.meta.url),'utf8').replace('export function createCaptcha','function createCaptcha').replace('    reset,','    reset, __inspect:()=>state,');
  vm.runInNewContext(source+'\nglobalThis.create = createCaptcha;',sandbox);
  let now=0;
  return {document,window,frames,tick(ms=16){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(f=>f(now));},create(options={}){const container=new Element();const api=sandbox.create(container,{noise:{dots:0},cracks:{count:0},...options});const root=container.children[0].shadowRoot;return {api,container,canvas:root.getElementById('puzzle'),rotate:root.getElementById('rotate')};}};
}
function pointer(widget,type,x,y,id=1){const e=new Event(type,{cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:id,isPrimary:id===1,button:0});widget.canvas.dispatchEvent(e);}
function start(w){const s=w.api.__inspect();pointer(w,'pointerdown',s.x,s.y);}
function target(w,type='pointermove'){const s=w.api.__inspect(),t=s.target;pointer(w,type,t.x+s.dx,t.y+s.dy);}


test('nightmare reverses pointer movement with double displacement',()=>{
 const w=environment().create({nightmare:true,changes:0});start(w);
 const s=w.api.__inspect(),x=s.x,y=s.y;
 pointer(w,'pointermove',x-10,y-10);
 assert.equal(s.x,x+20);assert.equal(s.y,y+20);w.api.destroy();
});
test('autospin stops near target so alignment remains possible',()=>{
 const env=environment(),w=env.create({nightmare:true,changes:0,effects:{rotation:true}});start(w);
 const s=w.api.__inspect();s.x=100;s.y=100;s.target.x=700;s.target.y=400;
 const angle=s.angle;for(let i=0;i<16;i++)env.tick(100);
 assert.equal(s.angle,(angle+45)%360);
 s.x=s.target.x;s.y=s.target.y;const nearAngle=s.angle;
 for(let i=0;i<20;i++)env.tick(100);
 assert.equal(s.angle,nearAngle);w.api.destroy();
});
test('single-target intro remains completable',()=>{
 const w=environment().create({singleTarget:true,changes:0});
 assert.equal(w.api.__inspect().holes.length,1);start(w);target(w);target(w,'pointerup');
 assert.equal(w.api.getState().status,'success');w.api.destroy();
});
