export function createPublicReveal(entries, kind, phase = 2) {
  const ordered = entries.map(entry => ({ ...entry })).sort((a, b) => b.pct - a.pct);
  return {
    kind, phase, entries: ordered, visible: [], cursor: 0, screen: "announce", selectedId: "",
    targets: kind === "duel" ? ordered.map((_, i) => i) : phase === 1 ? [4, 3] : [2, 0],
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
