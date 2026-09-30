import {dragDelta,flee,inside} from './defiance-model.js';
export function createDefiance(container,options={}){
 if(typeof container==='string')container=document.querySelector(container);
 const host=document.createElement('div');host.className='defiance';container.append(host);
 host.innerHTML='<div class="defiance-head"><span>BEHAVIORAL REJECTION LAB</span><b>试验 005</b></div><p class="defiance-rules">规则：按住方块驱赶圆形缺口进入绿色收容区，收容后再将方块移入缺口。越快阻力越大。三轮依次反转横轴、纵轴、双轴，全程不得松手。最终对齐后保持指针静止 2 秒再释放。红色信息无效。</p><div class="defiance-metrics"><span class="round"></span><span class="axis"></span><span class="state"></span></div><canvas width="720" height="460" aria-label="拖动方块驱赶逃跑缺口"></canvas><p class="defiance-result" role="status"></p>';
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),abort=new AbortController();
 let round=0,piece={x:360,y:365},target={x:350,y:185},zone={x:560,y:130},locked=false,down=false,ended=false,destroyed=false,pointer,previous,lastMove=0,last=performance.now(),still=0,raf;
 const label=selector=>host.querySelector(selector);
 function fail(){if(ended)return;ended=true;down=false;label('.defiance-result').textContent='试验终止。';options.onFail?.({success:false,reason:'试验终止'});}
 function update(){label('.round').textContent='ROUND 0'+(round+1)+' / 03';label('.axis').textContent=['X 轴反转','Y 轴反转','X + Y 轴反转'][round];label('.state').textContent=locked?'已收容':'未收容';}
 function next(){round++;locked=false;still=0;target={x:360,y:175};zone=round===1?{x:150,y:120}:{x:550,y:320};update();options.onChange?.({changesCompleted:round});}
 function draw(t){ctx.fillStyle='#151923';ctx.fillRect(0,0,720,460);ctx.strokeStyle='#252c39';ctx.lineWidth=1;for(let i=0;i<720;i+=30){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,460);ctx.stroke();}for(let i=0;i<460;i+=30){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(720,i);ctx.stroke();}
 ctx.fillStyle='#729e7520';ctx.strokeStyle='#8fbd86';ctx.lineWidth=2;ctx.beginPath();ctx.arc(zone.x,zone.y,55,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#aac6a0';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText('收容区',zone.x,zone.y+75);
 ctx.setLineDash(locked?[]:[5,5]);ctx.strokeStyle=locked?'#a9ca86':'#e7b97b';ctx.lineWidth=4;ctx.beginPath();ctx.arc(target.x,target.y,29,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d4b185';ctx.font='10px monospace';ctx.fillText(locked?'LOCKED':'逃逸体',target.x,target.y-42);
 ctx.save();ctx.translate(piece.x,piece.y);ctx.fillStyle='#e5d7bf';ctx.shadowColor='#e5c494';ctx.shadowBlur=12;ctx.fillRect(-20,-20,40,40);ctx.shadowBlur=0;ctx.strokeStyle='#806b53';ctx.strokeRect(-14,-14,28,28);ctx.restore();
 if(round===2&&locked&&inside(piece,target,22)){ctx.fillStyle='#9e3944';ctx.fillRect(160,12,400,43);ctx.fillStyle='#fff0db';ctx.font='bold 17px monospace';ctx.fillText('立即松手！剩余 '+Math.max(0,3-Math.floor(still/650))+' 秒',360,40);}
 if(ended){ctx.fillStyle='#10141bc9';ctx.fillRect(0,0,720,460);ctx.fillStyle='#f4debd';ctx.font='bold 26px system-ui';ctx.fillText(label('.defiance-result').textContent,360,225);}
 }
 function frame(t){if(destroyed)return;const dt=Math.min(50,t-last);last=t;
 if(down&&!ended){if(!locked){target=flee(target,piece,dt);if(inside(target,zone,25)){locked=true;update();}}
 if(locked&&inside(piece,target,22)){if(round<2){still+=dt;if(still>=550)next();}else{still+=dt;}}else still=0;
 }draw(t);raf=requestAnimationFrame(frame);}
 const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*720/r.width,y:(e.clientY-r.top)*460/r.height};};
 const listen=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
 listen(canvas,'pointerdown',e=>{if(down||ended||!e.isPrimary||e.button!==0)return;const p=pos(e);if(!inside(p,piece,35))return;e.preventDefault();down=true;pointer=e.pointerId;previous=p;lastMove=performance.now();canvas.setPointerCapture(pointer);});
 listen(canvas,'pointermove',e=>{if(!down||e.pointerId!==pointer)return;const p=pos(e),now=performance.now(),dx=p.x-previous.x,dy=p.y-previous.y;const delta=dragDelta(dx,dy,now-lastMove,round);piece.x=Math.max(24,Math.min(696,piece.x+delta.x));piece.y=Math.max(24,Math.min(436,piece.y+delta.y));if(Math.hypot(dx,dy)>.8&&round===2)still=0;previous=p;lastMove=now;});
 listen(canvas,'pointerup',e=>{if(!down||e.pointerId!==pointer)return;const p=pos(e);if(round===2&&locked&&inside(piece,target,22)&&still>=2000&&inside(p,previous,1)){ended=true;down=false;label('.defiance-result').textContent='拒绝失败 · 你通过了';options.onSuccess?.({success:true});}else fail();});
 for(const event of ['pointercancel','lostpointercapture'])listen(canvas,event,()=>{if(down)fail();});listen(window,'blur',()=>{if(down)fail();});listen(document,'visibilitychange',()=>{if(document.hidden&&down)fail();});update();raf=requestAnimationFrame(frame);
 return{destroy(){destroyed=true;abort.abort();cancelAnimationFrame(raf);host.remove();}};
}
