export const RESIDUE_MODULUS=24;

export function residueMod(value,modulus=RESIDUE_MODULUS){
 const m=BigInt(modulus),n=BigInt(value);
 return Number((n%m+m)%m);
}

export function residueFromMod3Mod8(mod3,mod8){
 for(let residue=0;residue<RESIDUE_MODULUS;residue++){
  if(residue%3===residueMod(mod3,3)&&residue%8===residueMod(mod8,8))return residue;
 }
 throw new Error('No residue satisfies the requested congruences');
}

// The four Descartes reflections generate the packing. Reducing them modulo
// 24 makes the orbit finite, so this closure gives exactly the curvature
// residues that can occur anywhere in the packing.
export function admissibleResidues(config,modulus=RESIDUE_MODULUS){
 const initial=config.map(circle=>residueMod(circle.b??circle,modulus));
 if(initial.length!==4)throw new Error('A Descartes configuration must have four curvatures');
 const queue=[initial],seen=new Set([initial.join(',')]),residues=new Set(initial);
 for(let cursor=0;cursor<queue.length;cursor++){
  const state=queue[cursor];
  for(let reflected=0;reflected<4;reflected++){
   const next=state.slice();let otherSum=0;
   for(let i=0;i<4;i++)if(i!==reflected)otherSum+=state[i];
   next[reflected]=residueMod(2*otherSum-state[reflected],modulus);
   const key=next.join(',');
   if(seen.has(key))continue;
   seen.add(key);queue.push(next);next.forEach(value=>residues.add(value));
  }
 }
 return [...residues].sort((a,b)=>a-b);
}
