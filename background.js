// Fetches candles from Yahoo Finance's free public chart endpoint (no API key).
const RANGE = { "1m": "5d", "5m": "5d", "15m": "1mo", "1h": "3mo", "1d": "2y" };

async function fetchBars(symbol, interval) {
  const range = RANGE[interval] || "5d";
  let lastErr;
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=${interval}&range=${range}&includePrePost=false`;
      const res = await fetch(url, { credentials: "omit", cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const r = (await res.json()).chart.result[0];
      const q = r.indicators.quote[0];
      const bars = [];
      for (let i = 0; i < r.timestamp.length; i++) {
        if (q.close[i] == null || q.high[i] == null || q.low[i] == null) continue;
        bars.push({ t: r.timestamp[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] || 0 });
      }
      if (bars.length < 60) throw new Error("not enough data");
      return bars;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// Company name -> ticker, via Yahoo's free search endpoint.
async function searchSymbol(q, strict) {
  const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0`,
    { credentials: "omit" });
  const quotes = (await res.json()).quotes || [];
  const hit = quotes.find((x) => x.quoteType === "EQUITY" || x.quoteType === "ETF") || quotes[0];
  if (!hit) return null;
  if (strict) { // the result's name must actually contain what was clicked
    const w = q.toLowerCase().split(/\s+/)[0], name = ((hit.shortname || "") + " " + (hit.longname || "")).toLowerCase();
    if (w.length < 3 || !name.includes(w)) return null;
  }
  return hit.symbol;
}

// ---- Trading 212: the ticker is not in the address bar, so read it from the
// app's own data requests (e.g. the candle request for the chart you opened).
const tabHints = new Map(); // tabId -> { code, chart }
const sniffLog = [];
const CODE_RE = /\b([A-Z0-9.]{1,8}[a-z]?_(?:[A-Z]{2}_)?EQ)\b/g;
const KEY_RE = /"(?:instCode|ticker|instrumentCode|code|symbol)"\s*:\s*"([#A-Za-z0-9._\-]{1,24})"/g;

browser.webRequest.onBeforeRequest.addListener((d) => {
  if (d.tabId < 0) return;
  let text = d.url, path = "";
  try { const u = new URL(d.url); path = u.pathname; text = decodeURIComponent(u.pathname + u.search); } catch (e) {}
  const rb = d.requestBody;
  if (rb && rb.raw) {
    for (const part of rb.raw) if (part.bytes && part.bytes.byteLength < 20000) text += " " + new TextDecoder().decode(part.bytes);
  } else if (rb && rb.formData) text += " " + JSON.stringify(rb.formData);
  let codes = new Set([...text.matchAll(CODE_RE)].map((m) => m[1]));
  const chart = /chart|candle/i.test(path);
  if (!codes.size && chart) codes = new Set([...text.matchAll(KEY_RE)].map((m) => m[1]));
  if (!codes.size) return;
  sniffLog.push({ path, codes: [...codes].slice(0, 6) }); if (sniffLog.length > 25) sniffLog.shift();
  if (codes.size !== 1) return;
  const prev = tabHints.get(d.tabId);
  if (!chart && prev && prev.chart) return; // chart requests are the most trustworthy
  const code = [...codes][0];
  tabHints.set(d.tabId, { code, chart });
  browser.tabs.sendMessage(d.tabId, { type: "sniff", code }).catch(() => {});
}, { urls: ["*://*.trading212.com/*"] }, ["requestBody"]);
browser.tabs.onRemoved.addListener((id) => tabHints.delete(id));

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "search") return searchSymbol(msg.q, msg.strict).catch(() => null);
  if (msg && msg.type === "hint?") { const h = sender.tab && tabHints.get(sender.tab.id); return Promise.resolve(h ? h.code : null); }
  if (msg && msg.type === "log?") return Promise.resolve(sniffLog);
  if (msg && msg.type === "bars") {
    return fetchBars(msg.symbol, msg.interval)
      .then((bars) => ({ ok: true, bars }))
      .catch((e) => ({ ok: false, error: String(e && e.message || e) }));
  }
});

// Toolbar button: ask the page for a ticker (useful when none was auto-detected).
browser.browserAction.onClicked.addListener((tab) => {
  browser.tabs.sendMessage(tab.id, { type: "prompt" }).catch(() => {});
});
