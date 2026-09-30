export const axes = [[-1,1],[1,-1],[-1,-1]];
export function dragDelta(dx,dy,ms,round){const speed=Math.hypot(dx,dy)/Math.max(8,ms);const gain=1/(1+speed*speed*2);return {x:dx*gain*axes[round][0],y:dy*gain*axes[round][1]};}
export function flee(target,piece,dt){const dx=target.x-piece.x,dy=target.y-piece.y,d=Math.hypot(dx,dy);if(d>0&&d<145){const step=Math.min(3,dt*.07)*(1-d/180);return {x:Math.max(42,Math.min(678,target.x+dx/d*step)),y:Math.max(42,Math.min(418,target.y+dy/d*step))};}return {...target};}
export const inside=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<=r;
