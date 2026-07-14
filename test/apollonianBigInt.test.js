import test from 'node:test';
import assert from 'node:assert/strict';
import {createTree,reflect,toFloat,visibleTree} from '../src/apollonianBigInt.js';
import {presets} from '../src/presets.js';

function sameCircle(a,b){
 return a.b===b.b&&a.bx.n===b.bx.n&&a.bx.d===b.bx.d&&a.by.n===b.by.n&&a.by.d===b.by.d;
}

for(const name of ['(-1,2,2,3)','(-2,3,6,7)','(-76,77,5852,5853)']){
 test(`keeps the curved outer valley visible for ${name}`,()=>{
  const config=presets[name];
  const reflected=reflect(config,3),target=reflected[3],circle=toFloat(target);
  const inset=circle.r*.45;
  const viewport={left:circle.x-inset,right:circle.x+inset,bottom:circle.y-inset,top:circle.y+inset};
  const visible=visibleTree(createTree(config),viewport,Math.abs(Number(circle.b))*20);
  assert.ok(visible.some(candidate=>sameCircle(candidate,target)),'reflected circle was pruned with its curved valley');
 });
}
