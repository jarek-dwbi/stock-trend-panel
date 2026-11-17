// Pure indicator maths. bars = [{h,l,c,v}, ...] oldest first.
(function (root) {
  function ema(a, n) {
    const k = 2 / (n + 1), out = new Array(a.length);
    out[0] = a[0];
    for (let i = 1; i < a.length; i++) out[i] = a[i] * k + out[i - 1] * (1 - k);
    return out;
  }
  function sma(a, n) {
    const out = new Array(a.length); let s = 0;
    for (let i = 0; i < a.length; i++) {
      s += a[i]; if (i >= n) s -= a[i - n];
      out[i] = s / Math.min(i + 1, n);
    }
    return out;
  }
  function wilder(a, n) { // Wilder's smoothing (RMA)
    const out = new Array(a.length); out[0] = a[0];
    for (let i = 1; i < a.length; i++) out[i] = (out[i - 1] * (n - 1) + a[i]) / n;
    return out;
  }
  function rsi(c, n) {
    const up = [0], dn = [0];
    for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1]; up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
    const au = wilder(up, n), ad = wilder(dn, n);
    return au.map((u, i) => (ad[i] === 0 ? (u === 0 ? 50 : 100) : 100 - 100 / (1 + u / ad[i])));
  }
  function atrAdx(bars, n) {
    const tr = [bars[0].h - bars[0].l], pdm = [0], mdm = [0];
    for (let i = 1; i < bars.length; i++) {
      const b = bars[i], p = bars[i - 1];
      tr.push(Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c)));
      const u = b.h - p.h, d = p.l - b.l;
      pdm.push(u > d && u > 0 ? u : 0); mdm.push(d > u && d > 0 ? d : 0);
    }
    const atr = wilder(tr, n), sp = wilder(pdm, n), sm = wilder(mdm, n);
    const dx = atr.map((a, i) => {
      if (!a) return 0;
      const p = sp[i] / a, m = sm[i] / a;
      return p + m === 0 ? 0 : (100 * Math.abs(p - m)) / (p + m);
    });
    return { atr, adx: wilder(dx, n) };
  }

  // k-nearest-neighbours classifier (Lorentzian distance): finds the past bars
  // that looked most like "now" and reports how often price was higher 4 bars later.
  function knnUp(feat, c, horizon, k) {
    const n = c.length, q = feat[n - 1], start = Math.max(60, n - 1500), best = [];
    for (let i = start; i < n - horizon; i++) {
      let d = 0;
      for (let j = 0; j < q.length; j++) d += Math.log(1 + Math.abs(feat[i][j] - q[j]));
      best.push([d, c[i + horizon] > c[i] ? 1 : 0]);
    }
    if (best.length < k) return null;
    best.sort((a, b) => a[0] - b[0]);
    let up = 0; for (let i = 0; i < k; i++) up += best[i][1];
    return (100 * up) / k;
  }

  function analyse(bars) {
    const c = bars.map((b) => b.c), v = bars.map((b) => b.v), n = c.length, L = n - 1;
    const e20 = ema(c, 20), e50 = ema(c, 50), e200 = ema(c, 200);
    const r = rsi(c, 14), { atr, adx } = atrAdx(bars, 14);
    const m12 = ema(c, 12), m26 = ema(c, 26);
    const macd = m12.map((x, i) => x - m26[i]), sig = ema(macd, 9), hist = macd[L] - sig[L];

    const trend = e20[L] >= e50[L] ? "Long" : "Short";
    const strength = (Math.abs(e20[L] - e50[L]) / e50[L]) * 100;
    const momentum = hist > 0 && r[L] > 50 ? "Bullish" : hist < 0 && r[L] < 50 ? "Bearish" : "Neutral";

    // Volatility: where the current ATR% sits among the last 200 bars.
    const ap = atr.map((a, i) => a / c[i]), win = ap.slice(Math.max(14, n - 200));
    const pct = win.filter((x) => x <= ap[L]).length / win.length;
    const volatility = pct < 0.34 ? "Low" : pct > 0.67 ? "High" : "Medium";

    const vs = sma(v, 5)[L], vl = sma(v, 20)[L];
    const volume = !vl ? "No Data" : vs > vl * 1.2 ? "Rising" : vs < vl * 0.8 ? "Falling" : "No Trend";

    const closeEma = c[L] >= e200[L] ? "Above" : "Below";
    const consolidation = adx[L] < 20 ? "Consolidating" : "Trending";

    const feat = c.map((x, i) => [
      r[i] / 100,
      atr[i] ? (x - e20[i]) / atr[i] / 4 : 0,
      atr[i] && i >= 5 ? (x - c[i - 5]) / atr[i] / 4 : 0,
      adx[i] / 100,
    ]);
    const ml = knnUp(feat, c, 4, 25);

    return { trend, strength, momentum, volatility, volume, closeEma, consolidation, ml, price: c[L] };
  }

  root.STP = { analyse };
  if (typeof module !== "undefined") module.exports = root.STP;
})(typeof globalThis !== "undefined" ? globalThis : this);
