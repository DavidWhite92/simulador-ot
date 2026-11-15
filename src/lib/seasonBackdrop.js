// Follow the event currently visible, rather than the next unrevealed event.
export function seasonBackdrop({ started, week, chat }) {
  if (!started) return 'studio';
  if (chat) return 'salon';
  if (!week || week.done || week.phase !== 'events') return 'studio';
  const event = week.events?.[week.shown - 1];
  if (event?.kind === 'rehearsal') return 'aula';
  if (event?.kind === 'mic') return 'micros';
  return 'salon';
}
