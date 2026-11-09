/** Jours fériés légaux en France métropolitaine (hors Alsace-Moselle) : date AAAA-MM-JJ → nom. */
export function frenchHolidays(year: number): Map<string, string> {
  const d = (m: number, day: number) => `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const shift = (base: Date, days: number) => new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
  const easter = easterSunday(year);
  return new Map([
    [d(1, 1), 'Jour de l’an'],
    [shift(easter, 1), 'Lundi de Pâques'],
    [d(5, 1), 'Fête du travail'],
    [d(5, 8), 'Victoire 1945'],
    [shift(easter, 39), 'Ascension'],
    [shift(easter, 50), 'Lundi de Pentecôte'],
    [d(7, 14), 'Fête nationale'],
    [d(8, 15), 'Assomption'],
    [d(11, 1), 'Toussaint'],
    [d(11, 11), 'Armistice'],
    [d(12, 25), 'Noël'],
  ]);
}

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function easterSunday(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
