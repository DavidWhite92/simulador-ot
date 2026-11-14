export function createPublicReveal(entries, kind, phase = 2, random=Math.random) {
  const ordered = entries.map(entry => ({ ...entry })).sort((a, b) => b.pct - a.pct);
  let targets=phase === 1 ? [4,3] : [2,0];
  if(kind==='duel' && ordered.length>=3) {
    const shuffle=items=>{const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
    const safe=shuffle(ordered.map((_,i)=>i).slice(0,-2));
    const bottom=shuffle([ordered.length-2,ordered.length-1]);
    targets=[...shuffle([...safe.slice(1),bottom[0]]),...shuffle([safe[0],bottom[1]])];
  }
  if(kind==='duel' && ordered.length<3) targets=ordered.map((_,i)=>i);
  return {
    kind, phase, entries: ordered, visible: [], cursor: 0, screen: "announce", selectedId: "",
    targets,
  };
}

export function assignPublicPercentage(reveal, chosenId) {
  const index = reveal.targets[reveal.cursor];
  const source = reveal.entries.findIndex(row => String(row.id) === String(chosenId));
  if (source < 0 || reveal.visible.includes(source)) return null;
  const entries = reveal.entries.map(row => ({ ...row }));
  const targetPct = entries[index].pct;
  const sourcePct = entries[source].pct;
  [entries[index], entries[source]] = [{ ...entries[source], pct: targetPct }, { ...entries[index], pct: sourcePct }];
  const visible = [...new Set([...reveal.visible, index, ...(reveal.kind === "final" && index === 0 ? [1] : [])])];
  return { ...reveal, entries, visible, selectedId: "", screen: "revealed" };
}
