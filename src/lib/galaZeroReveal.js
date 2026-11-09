import { captureScoreResult } from "./scoreReveal.js";
import { mixedJuryOrder } from './juryPerformance.js';

export function prepareGalaZeroJury(calculate, initial) {
  let pending = initial;
  const order = initial.gstate.g0.order || [];
  const completedBefore = initial.gstate.g0.idx || 0;
  for (let i = 0; i <= order.length && pending.stage === "g0_eval"; i++) {
    const next = captureScoreResult(calculate, pending, 0);
    if (next.gstate === pending.gstate && next.stage === pending.stage) return null;
    pending = next;
  }
  if (pending.stage !== "g0_profes") return null;
  const doubt = new Set(pending.gstate.g0.doubt || []);
  const events = mixedJuryOrder(order.slice(completedBefore), doubt).map(id => ({ id, doubt: doubt.has(id) }));
  if (initial.summaries[0]?.performances) {
    const safe = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const logs = [...(initial.galaLogs[0] || [])];
    for (const event of events) {
      const feedback = initial.summaries[0].performances[event.id];
      const name = initial.contestants.find(c => c.id === event.id)?.name || event.id;
      if (feedback) logs.push(`⚖️ ${safe(feedback.judge)} a <strong>${safe(name)}</strong>: ${safe(feedback.critique)}`);
      logs.push(`${event.doubt ? '⚠️' : '🎤'} ${safe(name)} ${event.doubt ? 'queda en duda.' : 'entra directamente a la Academia.'}`);
    }
    pending = { ...pending, galaLogs: { ...pending.galaLogs, 0: logs } };
  }
  return {
    events,
    completedBefore, index: 0, phase: "present", pending,
  };
}
