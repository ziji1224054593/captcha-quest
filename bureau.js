export function createBureau(container, options = {}) {
  if (typeof container === 'string') container = document.querySelector(container);
  const host = document.createElement('div'); host.className = 'bureau'; container.append(host);
  host.innerHTML = '<div class="bureau-top"><span>人类资格审批大厅</span><b>窗口 004</b></div><p class="bureau-rule">规则：记忆亮起的窗口；绿章执行、红章反向；各窗口停留半秒，全程按住；无效印章不生效；完成窗口审批后回起点停留一秒再松手。</p><div class="bureau-order" role="status"></div><canvas width="720" height="470" aria-label="拖动公章完成四轮审批"></canvas><div class="bureau-stamps">人类资格核验处 · 请以有效印章为准</div><p class="bureau-message" role="status"></p>';
  const canvas = host.querySelector('canvas'), ctx = canvas.getContext('2d');
  const order = host.querySelector('.bureau-order'), message = host.querySelector('.bureau-message');
  const abort = new AbortController(); let raf, destroyed = false;
  const home = {x:360,y:380}, slots = [{x:145,y:150},{x:360,y:150},{x:575,y:150}];
  let phase=0, target=Math.floor(Math.random()*3), x=home.x,y=home.y, pointer=null, down=false, ended=false, held=0,last=performance.now(), revealUntil=last+2300, fakeUntil=0;
  const near=(p)=>Math.hypot(x-p.x,y-p.y)<34;
  function fail(reason) { if(ended)return;ended=true;down=false;order.textContent='退件：请重新提交';message.textContent=reason+'';options.onFail?.({success:false,reason}); }
  function setOrder() {
    order.className='bureau-order '+(phase===2?'reversed':'');
    order.textContent=phase===0?'记忆备案':phase===1?'执行 / 请前往'+(target===0?'左侧':'右侧')+'窗口':phase===2?'反转 / 请前往'+(target===0?'右侧':'左侧')+'窗口':'执行 / 原件归档';
    message.textContent='';
  }
  function draw(t) {
    ctx.clearRect(0,0,720,470);ctx.fillStyle='#eee5d1';ctx.fillRect(0,0,720,470);
    ctx.strokeStyle='#d8ccb5';for(let yy=32;yy<470;yy+=32){ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(720,yy);ctx.stroke();}
    ctx.textAlign='center';ctx.font='14px system-ui';
    slots.forEach((p,i)=>{ctx.fillStyle=phase===0&&t<revealUntil&&i===target?'#739d78':'#d6c9b1';ctx.fillRect(p.x-48,p.y-48,96,96);ctx.strokeStyle='#84745d';ctx.strokeRect(p.x-48,p.y-48,96,96);ctx.fillStyle='#655840';ctx.fillText(['甲','乙','丙'][i]+'号窗口',p.x,p.y+76);});
    ctx.setLineDash([6,6]);ctx.strokeStyle='#8a7e69';ctx.strokeRect(home.x-45,home.y-40,90,80);ctx.setLineDash([]);ctx.fillStyle='#6b6050';ctx.fillText('原件归档处',home.x,home.y+63);
    ctx.save();ctx.translate(x,y);ctx.rotate(-.08);ctx.fillStyle='#f8efdc';ctx.fillRect(-33,-33,66,66);ctx.strokeStyle='#a4483d';ctx.lineWidth=4;ctx.strokeRect(-33,-33,66,66);ctx.fillStyle='#a4483d';ctx.font='bold 19px serif';ctx.fillText('本人',0,0);ctx.font='11px system-ui';ctx.fillText('核验专用',0,20);ctx.restore();
    if(t<fakeUntil){ctx.fillStyle='#5a3430ed';ctx.fillRect(65,245,590,68);ctx.fillStyle='#fff0cf';ctx.font='bold 21px system-ui';ctx.fillText('恭喜通关！现在松手？',360,274);ctx.font='13px system-ui';ctx.fillText('【无效印章】',360,299);}
  }
  function frame(t){if(destroyed)return;const dt=Math.min(100,t-last);last=t;
    if(down&&!ended){
      const correct=phase===3?near(home):near(slots[target]);
      held=correct&&(phase!==0||t>=revealUntil)?held+dt:0;
      if(phase<3&&held>=550){phase++;held=0;target=x<360?2:0;if(phase===3)fakeUntil=t+2400;setOrder();options.onChange?.({changesCompleted:phase});}

    }draw(t);raf=requestAnimationFrame(frame);
  }
  function position(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*720/r.width,y:(e.clientY-r.top)*470/r.height};}
  function listen(el,event,fn){el.addEventListener(event,fn,{signal:abort.signal});}
  listen(canvas,'pointerdown',e=>{if(ended||down||!e.isPrimary||e.button!==0)return;const p=position(e);if(Math.hypot(p.x-x,p.y-y)>48)return;e.preventDefault();down=true;pointer=e.pointerId;canvas.setPointerCapture(pointer);});
  listen(canvas,'pointermove',e=>{if(!down||e.pointerId!==pointer)return;const p=position(e);x=Math.max(35,Math.min(685,p.x));y=Math.max(35,Math.min(425,p.y));if(!(phase===3?near(home):near(slots[target])))held=0;});
  listen(canvas,'pointerup',e=>{if(!down||e.pointerId!==pointer)return;const p=position(e);x=p.x;y=p.y;if(phase===3&&near(home)&&held>=1000){ended=true;down=false;order.textContent='审批通过 / 确认为本人';message.textContent='你成功识破了所有套路。';options.onSuccess?.({success:true});}else fail('核验未通过。');});
  listen(canvas,'pointercancel',()=>{if(down)fail('触摸已中断。');});listen(canvas,'lostpointercapture',()=>{if(down)fail('拖动已中断。');});listen(window,'blur',()=>{if(down)fail('窗口失去焦点。');});listen(document,'visibilitychange',()=>{if(document.hidden&&down)fail('已离开审批页面。');});
  setOrder();raf=requestAnimationFrame(frame);
  return {destroy(){destroyed=true;abort.abort();cancelAnimationFrame(raf);host.remove();}};
}
