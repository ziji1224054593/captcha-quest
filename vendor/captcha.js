const defaults = {width:320,changes:1,tolerance:24,colorMotion:false,colorSpeed:2,textureInterval:800,noise:{dots:240,opacity:.18},cracks:{count:7,opacity:.22},effects:{textureMatch:false,rotation:false,spotlight:false,movingTargets:false,temporalClues:false,obstacles:false,ripples:false,outerRing:false},followDuration:500};
function normalizeOptions(options){
  const c={...defaults,...options,noise:{...defaults.noise,...options.noise},cracks:{...defaults.cracks,...options.cracks},effects:{...defaults.effects,...options.effects}};
  for(const key of Object.keys(c.effects))if(!(key in defaults.effects)||typeof c.effects[key]!=='boolean')throw new TypeError('Invalid effect: '+key);
  if(!Number.isInteger(c.followDuration)||c.followDuration<200||c.followDuration>3000)throw new RangeError('followDuration must be 200–3000');
  for(const [key,min,max,integer] of [['width',240,900,false],['changes',0,20,true],['tolerance',5,40,false],['colorSpeed',1,5,false],['textureInterval',0,60000,true]]){
    if(!Number.isFinite(c[key])||c[key]<min||c[key]>max||(integer&&!Number.isInteger(c[key])))throw new RangeError(key+' is out of range');
  }
  if(c.textureInterval>0&&c.textureInterval<200)throw new RangeError('textureInterval must be 0 or >= 200');
  for(const [value,max] of [[c.noise.dots,2000],[c.cracks.count,40]])if(!Number.isInteger(value)||value<0||value>max)throw new RangeError('Invalid texture count');
  for(const value of [c.noise.opacity,c.cracks.opacity])if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('Invalid opacity');
  if(typeof c.colorMotion!=='boolean')throw new TypeError('colorMotion must be boolean');
  for(const key of ['onSuccess','onFail','onChange'])if(c[key]!==undefined&&typeof c[key]!=='function')throw new TypeError(key+' must be a function');
  return c;
}
const template = `<style>
:host{display:block;font:12px system-ui,sans-serif;color:#294237}*{box-sizing:border-box}button{font:inherit;cursor:pointer}.box{border:1px solid #dfe5de;background:#fff;border-radius:12px;padding:12px;box-shadow:0 8px 25px #29423708}.top{display:flex;align-items:center;gap:8px;margin-bottom:10px}.top strong{font-size:12px}.top span{margin-left:auto;color:#899489;font-size:10px}button{border:0;background:#edf2e9;border-radius:5px;padding:4px 8px;color:#45634a}button:focus-visible{outline:2px solid #ab7c31;outline-offset:2px}.picture{position:relative;border-radius:7px;overflow:hidden}canvas{display:block;width:100%;height:auto;touch-action:none;cursor:grab}.scene{position:absolute;top:7px;left:9px;color:#ffffffb0;font-size:8px;pointer-events:none}.status{font-size:11px;line-height:1.6;padding-top:9px;min-height:29px;color:#63745e}.status.error{color:#a35839}.overlay{position:absolute;inset:0;background:#173e35ed;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;padding:10px;text-align:center}.overlay[hidden]{display:none}.overlay h2{font-size:17px;margin:5px}.overlay p{font-size:10px;margin:5px 0 12px}.overlay button{padding:7px 18px}.result-symbol{font-size:22px}.tools{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:10px;color:#65765d}.tools[hidden]{display:none}.tools button{touch-action:none;padding:7px 12px}.hint{font-size:10px;color:#77856d;line-height:1.7;margin:8px 0 0}.hint:empty{display:none}
</style><div class="box"><div class="top"><strong>◈ 连续拖拽验证</strong><span id="progress"></span><button id="refresh" type="button" aria-label="刷新挑战">↻</button></div><div class="picture"><canvas id="puzzle" width="900" height="600" aria-label="按住拼块拖到同形缺口，变化后继续拖动，完成全部匹配后松手"></canvas><span class="scene" id="sceneName"></span><div class="overlay" id="overlay" hidden><div class="result-symbol" id="resultSymbol"></div><h2 id="resultTitle"></h2><p id="resultMessage"></p><button type="button" id="retry">重新验证</button></div></div><div class="tools" id="rotationTools" hidden><button id="rotate" type="button" aria-label="顺时针旋转拼块45度">↻ 45°</button><span>拖动时用滚轮 / 方向键，触屏用另一根手指点旋转</span></div><p class="hint" id="effectHint"></p><div class="status" id="status" role="status" aria-live="polite"><span id="statusText"></span></div></div>`;
export function createCaptcha(container, options = {}) {
  if (typeof container === 'string') container = document.querySelector(container);
  if (!container || typeof container.appendChild !== 'function') throw new TypeError('A valid container is required');
  const config = normalizeOptions(options);
  const host = document.createElement('div');
  container.appendChild(host);
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = template;
  host.style.width = config.width + 'px'; host.style.maxWidth = '100%';
  const abort = new AbortController();
  let destroyed = false, animation = 0;
  function listen(target, name, handler) { target.addEventListener(name, handler, {signal:abort.signal}); }

  const canvas = root.querySelector('#puzzle');
  const ctx = canvas.getContext('2d');
  const $ = id => root.getElementById(id);
  const W = 900, H = 600, R = 43, SNAP = config.tolerance;
  const scenes = ['山间日落', '静谧海湾', '远山晨雾', '沙丘月色'];
  const palettes = [['#eab58d','#829d9d','#477480','#244f60','#123845'],['#dec69e','#7bafb1','#488991','#286370','#194756'],['#ddc6ad','#acbcb0','#718f83','#456c62','#2b514e'],['#d3a99c','#b995a1','#927f98','#655f7f','#444560']];
  // Distinct four-edge silhouettes. Edge values: protrusion, indentation, flat.
  const shapes = [[1,-1,0,1],[-1,1,1,0],[0,-1,1,-1],[1,0,-1,-1],[-1,-1,0,1],[0,1,-1,1]];
  let state, background, texture, textureTime = 0, lastTime = 0, hue = 0, elapsed = 0;
  const random = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  function path(shape) {
    const p = new Path2D(); p.moveTo(-R,-R);
    const edges = [[-R,-R,R,-R,0,-1],[R,-R,R,R,1,0],[R,R,-R,R,0,1],[-R,R,-R,-R,-1,0]];
    edges.forEach(([x,y,x2,y2,nx,ny],i) => {
      const dx=x2-x,dy=y2-y, v=shape[i]*23;
      p.lineTo(x+dx*.29,y+dy*.29);
      p.bezierCurveTo(x+dx*.24+nx*v,y+dy*.24+ny*v,x+dx*.76+nx*v,y+dy*.76+ny*v,x+dx*.71,y+dy*.71);
      p.lineTo(x2,y2);
    }); p.closePath(); return p;
  }
  function makeBackground(index) {
    const c=document.createElement('canvas'); c.width=W;c.height=H;
    const g=c.getContext('2d'), colors=palettes[index];
    const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,colors[0]);sky.addColorStop(.7,colors[1]);sky.addColorStop(1,colors[2]);g.fillStyle=sky;g.fillRect(0,0,W,H);
    g.fillStyle='#fff0c8';g.beginPath();g.arc(620+random(110),125+random(45),48,0,Math.PI*2);g.fill();
    for(let layer=0;layer<4;layer++){
      g.fillStyle=colors[Math.min(4,layer+1)];g.beginPath();g.moveTo(0,H);
      for(let x=0;x<=W+60;x+=60){const y=250+layer*75+Math.sin(x/150+index+layer)*55+random(65);g.lineTo(x,y);}
      g.lineTo(W,H);g.closePath();g.fill();
    }
    g.strokeStyle='#f3e9c328';g.lineWidth=2;
    for(let i=0;i<23;i++){const y=430+i*8,x=500+Math.sin(i)*35;g.beginPath();g.moveTo(x-i*8,y);g.lineTo(x+60+i*10,y);g.stroke();}
    for(let i=0;i<36;i++){const x=random(W),y=490+random(110);g.strokeStyle='#122e3650';g.beginPath();g.moveTo(x,y);g.lineTo(x+4,y-14-random(28));g.stroke();}
    return c;
  }
  function layout(previousShape=-1) {
    let shape=random(shapes.length);while(shape===previousShape)shape=random(shapes.length);
    const others=shapes.map((_,i)=>i).filter(i=>i!==shape);
    for(let i=others.length-1;i>0;i--){const j=random(i+1);[others[i],others[j]]=[others[j],others[i]];}
    const ids=config.singleTarget ? [shape] : [shape,...others.slice(0,3)];
    if(config.effects.textureMatch)ids[1]=shape;
    for(let i=ids.length-1;i>0;i--){const j=random(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}
    state.holes=placeHoles(ids);
    state.shape=shape;state.target=state.holes.find(h=>h.id===shape);
    state.angle=config.effects.rotation?(1+random(7))*45:0;
    state.spinTime=0;state.stage='drag';state.ringAngle=0;state.ringPointerAngle=null;
    state.followed=0;state.holes.forEach((h,i)=>{h.baseX=h.x;h.baseY=h.y;h.grain=(random(4)+i*4);h.motion=random(628)/100;});
    state.obstacles=makeObstacles();
    let scene=random(scenes.length);if(scene===state.scene)scene=(scene+1)%scenes.length;
    state.scene=scene;background=makeBackground(scene); texture=makeTexture();
    $('sceneName').textContent=`0${scene+1} / ${scenes[scene]}`;
  }
  function setStatus(text,error=false){$('statusText').textContent=text;$('status').classList.toggle('error',error);}
  function placeHoles(ids) {
    // Sample across the whole canvas, leaving room for contours and the held piece.
    const gap = 155;
    let points = [];
    const clear = point => [state,...points].every(other => Math.hypot(point.x-other.x,point.y-other.y)>=gap);
    for(let attempt=0;attempt<1000 && points.length<ids.length;attempt++){
      const point=config.effects.outerRing?{x:115+random(671),y:125+random(351)}:{x:80+random(741),y:95+random(426)};
      if(clear(point))points.push(point);
    }
    if(points.length<ids.length){
      // Bounded fallback: this separated lattice leaves ample choices around any held position.
      points=[];
      const candidates=[];
      for(let row=0;row<3;row++)for(let col=0;col<5;col++){
        candidates.push(config.effects.outerRing?{x:120+col*165+random(11)-5,y:130+row*170+random(11)-5}:{x:95+col*175+random(11)-5,y:110+row*195+random(11)-5});
      }
      for(let i=candidates.length-1;i>0;i--){const j=random(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
      for(const point of candidates){if(clear(point))points.push(point);if(points.length===ids.length)break;}
    }
    return points.map((point,i)=>({id:ids[i],...point}));
  }
  function releaseCapture(){if(state?.pointer!==null && state?.pointer!==undefined && canvas.hasPointerCapture(state.pointer))canvas.releasePointerCapture(state.pointer);}
  function reset(){
    if(destroyed)return; if(state)state.dragging=false; releaseCapture();state={phase:1,dragging:false,pointer:null,scene:-1,x:80+random(741),y:110+random(371),dx:0,dy:0,finished:false};
    layout();$('overlay').hidden=true;canvas.style.cursor='grab';
    $('rotationTools').hidden=!config.effects.rotation;
    $('effectHint').textContent=effectHint();
    updateProgress();setStatus('按住拼块，拖到同形缺口');draw();
  }
  function effectHint(){
    return [config.effects.textureMatch?'同形缺口需比对纹理':null,config.effects.rotation?'旋转拼块至轮廓吻合':null,config.effects.spotlight?'拖动探索照明区域':null,config.effects.movingTargets?'对齐并跟随 '+config.followDuration+'ms':null,config.effects.temporalClues?'轮廓与纹理交替显示':null,config.effects.obstacles?'绕开橙色障碍':null,config.effects.ripples?'波纹仅为视觉干扰':null,config.effects.outerRing?'拼块对齐后绕圆心拖动外环，全程不松手':null].filter(Boolean).join(' · ');
  }
  function makeObstacles(){
    if(!config.effects.obstacles)return [];
    const obstacles=[];
    for(let attempt=0;attempt<1000&&obstacles.length<2;attempt++){
      const p={x:120+random(661),y:120+random(361),radius:22};
      if([state,...state.holes,...obstacles].every(h=>Math.hypot(p.x-h.x,p.y-h.y)>150))obstacles.push(p);
    }
    return obstacles;
  }
  function grain(h){
    // Distinct, stable vein patterns remain identifiable between texture refreshes.
    ctx.strokeStyle='#e8e5af';ctx.lineWidth=5;ctx.beginPath();
    for(let i=0;i<4;i++){
      const x=-38+i*23;
      ctx.moveTo(x,-65);ctx.lineTo(x+Math.sin(h.grain+i)*23,-15);
      ctx.lineTo(x+Math.cos(h.grain*2+i)*25,20);ctx.lineTo(x-8,65);
    }ctx.stroke();
    ctx.strokeStyle='#183f45';ctx.lineWidth=3;ctx.beginPath();
    ctx.moveTo(-60,Math.sin(h.grain)*26);ctx.lineTo(0,Math.cos(h.grain)*30);ctx.lineTo(60,Math.sin(h.grain+2)*28);ctx.stroke();
  }
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.save();ctx.filter=config.colorMotion?'hue-rotate('+hue+'deg)':'none';ctx.drawImage(background,0,0);ctx.drawImage(texture,0,0);ctx.restore();
    const showTexture=state.stage==='ring'||!config.effects.temporalClues||Math.floor(elapsed/(config.nightmare?650:1400))%2===1;
    state.holes.forEach(h=>{
      if(state.stage==='ring'&&h!==state.target)return;
      ctx.save();ctx.translate(h.x,h.y);const outline=path(shapes[h.id]);
      ctx.fillStyle='#102d36c9';ctx.fill(outline);
      if(showTexture&&(config.effects.textureMatch||config.effects.temporalClues)){
        ctx.save();ctx.clip(outline);ctx.globalAlpha=.85;ctx.filter=config.colorMotion?'hue-rotate('+hue+'deg)':'none';ctx.drawImage(background,-h.baseX,-h.baseY);ctx.drawImage(texture,-h.baseX,-h.baseY);ctx.filter='none';grain(h);ctx.restore();
      }
      ctx.strokeStyle='#e5eed09c';ctx.lineWidth=2;ctx.stroke(outline);ctx.restore();
    });
    if(config.effects.ripples&&state.stage!=='ring'){
      ctx.save();ctx.strokeStyle='#d6e9e44d';ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        const x=170+i*270,y=170+Math.sin(i*3)*90;
        for(let j=0;j<3;j++){ctx.beginPath();ctx.arc(x,y,15+(elapsed*.025+j*24)%95,0,Math.PI*2);ctx.stroke();}
      }ctx.restore();
    }
    if(state.dragging&&state.stage!=='ring')state.obstacles.forEach(o=>{
      ctx.save();ctx.fillStyle='#df914bae';ctx.strokeStyle='#ffe0a8';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff3d4';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText('×',o.x,o.y+8);ctx.restore();
    });
    if(config.effects.spotlight&&state.stage!=='ring'){
      ctx.save();const light=ctx.createRadialGradient(state.x,state.y,95,state.x,state.y,240);
      light.addColorStop(0,'#10243100');light.addColorStop(1,'#102431b8');ctx.fillStyle=light;ctx.fillRect(0,0,W,H);ctx.restore();
    }
    ctx.save();ctx.translate(state.x,state.y);ctx.rotate(state.angle*Math.PI/180);const p=path(shapes[state.shape]);
    ctx.shadowColor='#071b3290';ctx.shadowBlur=22;ctx.shadowOffsetY=10;ctx.fillStyle='#e8edc8';ctx.fill(p);ctx.shadowColor='transparent';ctx.save();ctx.clip(p);
    ctx.filter=config.colorMotion?'hue-rotate('+hue+'deg)':'none';ctx.drawImage(background,-state.target.baseX,-state.target.baseY);ctx.drawImage(texture,-state.target.baseX,-state.target.baseY);ctx.filter='none';
    if(showTexture&&(config.effects.textureMatch||config.effects.temporalClues))grain(state.target);
    if(!showTexture){ctx.fillStyle='#35595b';ctx.fillRect(-75,-75,150,150);}
    ctx.restore();ctx.lineWidth=4;ctx.strokeStyle='#f2fac9';ctx.stroke(p);ctx.restore();
    if(state.stage==='ring')drawRing();
    if(config.effects.movingTargets&&state.followed>0&&state.stage!=='ring'){ctx.save();ctx.strokeStyle='#d5f392';ctx.lineWidth=5;ctx.beginPath();ctx.arc(state.x,state.y,77,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,state.followed/config.followDuration));ctx.stroke();ctx.restore();}
    if(!state.dragging&&!state.finished){ctx.fillStyle='#f4f5d7';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText('按住拖动',state.x,state.y+94);}
  }
  function position(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*W/b.width,y:(e.clientY-b.top)*H/b.height};}
  function matches(){return Math.hypot(state.x-state.target.x,state.y-state.target.y)<=(config.effects.movingTargets?Math.min(SNAP,12):SNAP)&&Math.min(state.angle,360-state.angle)<=8;}
  function innerReady(){return matches()&&(!config.effects.movingTargets||state.followed>=config.followDuration);}
  function ready(){return innerReady()&&(!config.effects.outerRing||(state.stage==='ring'&&Math.min(state.ringAngle,360-state.ringAngle)<=5));}
  function drawRing(){
    ctx.save();ctx.translate(state.x,state.y);ctx.rotate(state.ringAngle*Math.PI/180);
    ctx.beginPath();ctx.arc(0,0,100,0,Math.PI*2);ctx.arc(0,0,70,0,Math.PI*2,true);ctx.clip('evenodd');
    ctx.filter=config.colorMotion?'hue-rotate('+hue+'deg)':'none';
    ctx.drawImage(background,-state.x,-state.y);ctx.drawImage(texture,-state.x,-state.y);ctx.restore();
    ctx.save();ctx.strokeStyle=ready()?'#dbf7a3':'#f2d5a0';ctx.lineWidth=3;
    for(const radius of [70,100]){ctx.beginPath();ctx.arc(state.x,state.y,radius,0,Math.PI*2);ctx.stroke();}ctx.restore();
  }
  function enterRing(){
    state.stage='ring';state.x=state.target.x;state.y=state.target.y;
    state.ringAngle=(1+random(7))*45;state.ringPointerAngle=null;
    updateProgress();setStatus('不要松手！移到外环，绕圆心旋转使背景衔接');
  }
  function checkProgress(){
    if(config.effects.outerRing&&state.stage==='drag'&&innerReady()){enterRing();return;}
    if(state.phase<=config.changes&&ready()){
      state.phase++;layout(state.shape);state.dx=(state.pointerX??state.x)-state.x;state.dy=(state.pointerY??state.y)-state.y;updateProgress();setStatus('已变换！不要松手，继续匹配');draw();
      emit('change',{changesCompleted:state.phase-1,changes:config.changes});
    }else if(state.stage==='ring'&&!ready())setStatus('保持按住，沿圆周拖动外环，让纹理与背景衔接');
    else if(matches()&&config.effects.movingTargets&&!ready())setStatus('保持跟随：'+Math.min(100,Math.floor(state.followed/config.followDuration*100))+'%');
    else if(ready())setStatus('已完成匹配，现在可以松手');
    else setStatus('保持按住，匹配轮廓'+(config.effects.textureMatch?'与纹理':'')+(config.effects.rotation?'，注意旋转方向':''));
  }
  function crossesObstacle(from,to){
    return state.obstacles.some(o=>{
      const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((o.x-from.x)*dx+(o.y-from.y)*dy)/length)):0;
      return Math.hypot(from.x+t*dx-o.x,from.y+t*dy-o.y)<o.radius+65;
    });
  }
  function move(e){
    if(!state.dragging||e.pointerId!==state.pointer||state.finished)return;
    const p=position(e);const previousX=state.pointerX,previousY=state.pointerY;state.pointerX=p.x;state.pointerY=p.y;
    if(state.stage==='ring'){
      if(Math.hypot(p.x-state.x,p.y-state.y)>=35){
        const angle=Math.atan2(p.y-state.y,p.x-state.x);
        if(state.ringPointerAngle!==null){const delta=Math.atan2(Math.sin(angle-state.ringPointerAngle),Math.cos(angle-state.ringPointerAngle));state.ringAngle=(state.ringAngle+delta*180/Math.PI*(config.nightmare?-1:1)+360)%360;}
        state.ringPointerAngle=angle;
      }else state.ringPointerAngle=null;
      checkProgress();draw();return;
    }
    const next={x:Math.max(80,Math.min(W-80,(config.nightmare?state.x-2*(p.x-previousX):p.x-state.dx))),y:Math.max(95,Math.min(H-80,(config.nightmare?state.y-2*(p.y-previousY):p.y-state.dy)))};
    if(crossesObstacle(state,next)){state.followed=0;setStatus('前方有障碍，请保持按住并绕行',true);draw();return false;}
    state.x=next.x;state.y=next.y;
    if(!matches())state.followed=0;
    checkProgress();draw();
  }
  function rotate(){
    if(destroyed||state.finished||state.stage==='ring')return;
    state.angle=(state.angle+45)%360;state.followed=0;
    if(state.dragging)checkProgress();draw();
  }
  function finish(success,message){
    state.finished=true;state.dragging=false;releaseCapture();state.pointer=null;canvas.style.cursor='default';
    $('overlay').hidden=false;$('resultSymbol').textContent=success?'✓':'↗';$('resultTitle').textContent=success?'验证通过':'本次验证未通过';$('resultMessage').textContent=message;
    $('retry').innerHTML=success?'再体验一次 <span>↗</span>':'重新验证 <span>↗</span>';
    if(success){state.x=state.target.x;state.y=state.target.y;}
    setStatus(success?'验证通过':'挑战失效，请重试',!success);draw();
    emit('result',{success,reason:message,changesCompleted:state.phase-1,changes:config.changes});
  }
  listen(canvas,'pointerdown',e=>{
    if(state.finished||state.dragging||!e.isPrimary||e.button!==0)return;const p=position(e);
    const angle=-state.angle*Math.PI/180,dx=p.x-state.x,dy=p.y-state.y;
    if(!ctx.isPointInPath(path(shapes[state.shape]),dx*Math.cos(angle)-dy*Math.sin(angle),dx*Math.sin(angle)+dy*Math.cos(angle)))return;
    e.preventDefault();state.dragging=true;state.pointer=e.pointerId;state.dx=p.x-state.x;state.dy=p.y-state.y;state.pointerX=p.x;state.pointerY=p.y;
    canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';setStatus('保持按住，将拼块拖入轮廓相同的缺口');draw();
  });
  listen(canvas,'pointermove',move);
  listen(canvas,'pointerup',e=>{
    if(!state.dragging||e.pointerId!==state.pointer)return;
    const priorPhase=state.phase, moved=move(e);
    const success=moved!==false&&priorPhase===config.changes+1&&state.phase===priorPhase&&ready();
    finish(success,success?'所有匹配已完成。':state.phase!==priorPhase?'变换时不能松手，请保持按住继续拖动。':state.phase<=config.changes?'提前松手，请完成全部变换。':'位置、纹理、内外环角度或跟随时长不匹配，请重试。');
  });
  listen($('rotate'),'pointerdown',e=>{if(!config.effects.rotation)return;e.preventDefault();rotate();});
  listen($('rotate'),'click',e=>{if(e.detail===0&&config.effects.rotation)rotate();});
  canvas.addEventListener('wheel',e=>{if(config.effects.rotation&&state.dragging){e.preventDefault();rotate();}},{passive:false,signal:abort.signal});
  listen(window,'keydown',e=>{if(config.effects.rotation&&state.dragging&&state.stage!=='ring'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')state.angle=(state.angle+270)%360;rotate();}});
  const cancel=()=>{if(state.dragging&&!state.finished)finish(false,'拖拽已中断，请全程保持按住后重试。');};
  listen(canvas,'pointercancel',cancel);listen(canvas,'lostpointercapture',cancel);listen(window,'blur',cancel);
  listen(document,'visibilitychange',()=>{if(document.hidden)cancel();});
  listen($('refresh'),'click',reset);listen($('retry'),'click',reset);

  function updateProgress(){ $('progress').textContent='匹配 '+state.phase+' / '+(config.changes+1)+(state.stage==='ring'?' · 外环':''); }
  function emit(type, detail){
    container.dispatchEvent(new CustomEvent('morph:'+type,{detail}));
    const callback=type==='change'?config.onChange:(detail.success?config.onSuccess:config.onFail);
    if(callback)callback(detail);
  }
  function makeTexture(){
    const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
    g.globalAlpha=config.noise.opacity;
    for(let i=0;i<config.noise.dots;i++){
      g.fillStyle=i%2?'#f6ecd6':'#102d36';g.beginPath();g.arc(random(W),random(H),.6+random(28)/10,0,Math.PI*2);g.fill();
    }
    g.globalAlpha=config.cracks.opacity;
    for(let i=0;i<config.cracks.count;i++){
      let x=random(W),y=random(H);g.strokeStyle=i%2?'#f5ecd5':'#172d36';g.lineWidth=.7+random(15)/10;g.beginPath();g.moveTo(x,y);
      for(let j=0;j<7;j++){x+=random(55)-27;y+=12+random(25);g.lineTo(x,y);if(j===3){g.lineTo(x+30,y+14);g.moveTo(x,y);}}g.stroke();
    }
    return c;
  }
  function frame(t){
    if(destroyed)return;
    const dt=Math.max(0,Math.min(t-lastTime,100));lastTime=t;elapsed+=dt;
    if(!document.hidden&&!state.finished){
      let dirty=false;
      if(config.nightmare&&state.dragging&&state.stage!=='ring'){
        if(Math.hypot(state.x-state.target.x,state.y-state.target.y)>90){
          state.spinTime+=dt;
          if(state.spinTime>=1600){state.angle=(state.angle+45)%360;state.spinTime=0;state.followed=0;setStatus('恶作剧：拼块自行转动了 45°！接近目标后会停止自转');dirty=true;}
        }else state.spinTime=0;
      }
      if(config.colorMotion&&state.stage!=='ring'){hue=(hue+dt*config.colorSpeed*.012)%360;dirty=true;}
      if(state.stage!=='ring'&&config.textureInterval>0&&t-textureTime>=config.textureInterval){textureTime=t;texture=makeTexture();dirty=true;}
      if(config.effects.movingTargets&&state.stage!=='ring'){
        const margin=config.effects.outerRing?110:80;
        state.holes.forEach(h=>{h.x=Math.max(margin,Math.min(W-margin,h.baseX+18*Math.sin(elapsed/(config.nightmare?230:360)+h.motion)));h.y=Math.max(Math.max(95,margin),Math.min(H-margin,h.baseY+14*Math.cos(elapsed/(config.nightmare?280:440)+h.motion)));});
        if(state.dragging){state.followed=matches()?state.followed+dt:0;checkProgress();}dirty=true;
      }
      if(config.effects.ripples||config.effects.temporalClues)dirty=true;
      if(dirty&&!destroyed)draw();
    }
    animation=requestAnimationFrame(frame);
  }
  reset();animation=requestAnimationFrame(frame);
  return {
    reset,
    destroy(){if(destroyed)return;destroyed=true;state.dragging=false;releaseCapture();abort.abort();cancelAnimationFrame(animation);host.remove();},
    getState(){return {status:state.finished?($('resultSymbol').textContent==='✓'?'success':'failed'):(state.dragging?'dragging':'ready'),changesCompleted:state.phase-1,changes:config.changes};}
  };
}
