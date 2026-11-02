// Bikram Sambat (Nepali) calendar engine. Data: BS 2060-2090 (AD 2003-2034).
const BS = (() => {
  const DATA = {
  2060:[31,31,32,32,31,30,30,29,30,29,30,30],
  2061:[31,32,31,32,31,30,30,30,29,29,30,31],
  2062:[30,32,31,32,31,31,29,30,29,30,29,31],
  2063:[31,31,32,31,31,31,30,29,30,29,30,30],
  2064:[31,31,32,32,31,30,30,29,30,29,30,30],
  2065:[31,32,31,32,31,30,30,30,29,29,30,31],
  2066:[31,31,31,32,31,31,29,30,30,29,29,31],
  2067:[31,31,32,31,31,31,30,29,30,29,30,30],
  2068:[31,31,32,32,31,30,30,29,30,29,30,30],
  2069:[31,32,31,32,31,30,30,30,29,29,30,31],
  2070:[31,31,31,32,31,31,29,30,30,29,30,30],
  2071:[31,31,32,31,31,31,30,29,30,29,30,30],
  2072:[31,32,31,32,31,30,30,29,30,29,30,30],
  2073:[31,32,31,32,31,30,30,30,29,29,30,31],
  2074:[31,31,31,32,31,31,30,29,30,29,30,30],
  2075:[31,31,32,31,31,31,30,29,30,29,30,30],
  2076:[31,32,31,32,31,30,30,30,29,29,30,30],
  2077:[31,32,31,32,31,30,30,30,29,30,29,31],
  2078:[31,31,31,32,31,31,30,29,30,29,30,30],
  2079:[31,31,32,31,31,31,30,29,30,29,30,30],
  2080:[31,32,31,32,31,30,30,30,29,29,30,30],
  2081:[31,32,31,32,31,30,30,30,29,30,29,31],
  2082:[31,31,32,31,31,31,30,29,30,29,30,30],
  2083:[31,31,32,31,31,31,30,29,30,29,30,30],
  2084:[31,31,32,31,31,30,30,30,29,30,30,30],
  2085:[31,32,31,32,30,31,30,30,29,30,30,30],
  2086:[30,32,31,32,31,30,30,30,29,30,30,30],
  2087:[31,31,32,31,31,31,30,30,29,30,30,30],
  2088:[30,31,32,32,30,31,30,30,29,30,30,30],
  2089:[30,32,31,32,31,30,30,30,29,30,30,30],
  2090:[30,32,31,32,31,30,30,30,29,30,30,30]
  };
  const START = 2060, END = 2090, ANCHOR = Date.UTC(2003, 3, 14), DAY = 864e5;
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = {
    en: ['Baishakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'],
    ne: ['बैशाख','जेठ','असार','साउन','भदौ','असोज','कार्तिक','मंसिर','पुष','माघ','फागुन','चैत']
  };
  const WEEK = {
    en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    ne: ['आइत','सोम','मंगल','बुध','बिही','शुक्र','शनि']
  };
  function dim(y, m) { return (DATA[y] || [])[m - 1] || 30; }
  function str(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parse(s) { const p = String(s).split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; }
  function valid(s) { const { y, m, d } = parse(s); return y >= START && y <= END && m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m); }
  function toAD(s) {
    const { y, m, d } = parse(s); let days = 0;
    for (let yy = START; yy < y; yy++) days += DATA[yy].reduce((a, b) => a + b, 0);
    for (let mm = 1; mm < m; mm++) days += DATA[y][mm - 1];
    days += d - 1;
    return new Date(ANCHOR + days * DAY); // UTC midnight
  }
  function fromAD(date) {
    let days = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - ANCHOR) / DAY);
    if (days < 0) return str(START, 1, 1);
    let y = START, m = 1;
    while (y <= END) {
      const len = DATA[y][m - 1];
      if (days < len) return str(y, m, days + 1);
      days -= len; m++; if (m > 12) { m = 1; y++; }
    }
    return str(END, 12, dim(END, 12));
  }
  function today() { return fromAD(new Date()); }
  function addDays(s, n) { const a = toAD(s); return fromAD(new Date(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate() + n)); }
  function weekday(s) { return toAD(s).getUTCDay(); }
  function diffDays(a, b) { return Math.round((toAD(b) - toAD(a)) / DAY); }
  function monthStart(y, m) { return str(y, m, 1); }
  function monthEnd(y, m) { return str(y, m, dim(y, m)); }
  // Fiscal year starts 1 Shrawan (month 4)
  function fyOf(s) { const { y, m } = parse(s); return m >= 4 ? y : y - 1; }
  function fyStart(fy) { return str(fy, 4, 1); }
  function fyEnd(fy) { return monthEnd(fy + 1, 3); }
  return { DATA, START, END, MONTHS, WEEK, dim, str, parse, valid, toAD, fromAD, today, addDays, weekday, diffDays, monthStart, monthEnd, fyOf, fyStart, fyEnd };
})();
if (typeof module !== 'undefined') module.exports = BS;
