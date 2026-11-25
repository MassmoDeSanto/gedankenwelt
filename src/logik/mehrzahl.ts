/** Zahl mit passendem Wort: „1 Eintrag“, „3 Einträge“. */
export function mehrzahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}
