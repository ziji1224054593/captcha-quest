import test from 'node:test';import assert from 'node:assert/strict';import {dragDelta,flee,inside} from './defiance-model.js';
test('axes reverse in the declared order',()=>{for(let r=0;r<3;r++){const d=dragDelta(5,5,100,r);assert.equal(Math.sign(d.x),r===1?1:-1);assert.equal(Math.sign(d.y),r===0?1:-1);}});
test('fast movement produces greater resistance',()=>{assert.ok(Math.abs(dragDelta(10,0,100,0).x)>Math.abs(dragDelta(10,0,8,0).x));});
test('target flees nearby piece and stays bounded',()=>{const p=flee({x:350,y:150},{x:300,y:150},16);assert.ok(p.x>350);assert.equal(p.y,150);assert.ok(flee({x:678,y:150},{x:630,y:150},50).x<=678);assert.deepEqual(flee({x:350,y:150},{x:100,y:150},16),{x:350,y:150});});
test('target can be herded into capture zone',()=>{let p={x:350,y:185};const z={x:560,y:130};for(let i=0;i<500&&!inside(p,z,25);i++){const d=Math.hypot(z.x-p.x,z.y-p.y);p=flee(p,{x:p.x-(z.x-p.x)/d*70,y:p.y-(z.y-p.y)/d*70},16);}assert.ok(inside(p,z,25));});
