/**
 * Name einer Notiz (README, Abschnitt 12): Hat eine Notiz mehr als eine Zeile, ist die erste
 * Zeile ihr Name und der Rest ihr Text – so wie in Apple Notizen. Eine einzeilige Notiz hat
 * keinen eigenen Namen, sie ist der ganze Gedanke.
 */
export function nameUndRest(text: string): { name: string; rest: string } | null {
  const umbruch = text.indexOf('\n');
  if (umbruch < 0) return null;
  const name = text.slice(0, umbruch).trim();
  const rest = text.slice(umbruch + 1).trim();
  if (!name || !rest) return null;
  return { name, rest };
}
