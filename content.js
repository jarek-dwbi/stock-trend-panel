(() => {
  if (window.top !== window || window.__stpLoaded) return;
  window.__stpLoaded = true;

  const GREEN = "rgba(76,224,90,.72)", RED = "rgba(229,72,77,.72)";
  const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];
  const SUFFIX = { LSE: ".L", TSX: ".TO", TSXV: ".V", XETR: ".DE", FWB: ".F", ASX: ".AX", NSE: ".NS", BSE: ".BO",
    HKEX: ".HK", HKG: ".HK", TSE: ".T", TYO: ".T", SIX: ".SW", SWX: ".SW", MIL: ".MI", BME: ".MC", KRX: ".KS",
    SGX: ".SI", NZX: ".NZ", LON: ".L", ETR: ".DE", TSXVENTURE: ".V" };
  const CRYPTO_EX = new Set(["BINANCE", "COINBASE", "BITSTAMP", "CRYPTO", "KRAKEN", "BYBIT", "OKX", "CRYPTOCAP", "INDEX", "BITFINEX"]);
  const FX_EX = new Set(["FX", "OANDA", "FX_IDC", "FOREXCOM", "SAXO", "PEPPERSTONE"]);
  const STOCK_EX = new Set([...Object.keys(SUFFIX), "NASDAQ", "NYSE", "AMEX", "NYSEARCA", "NYSEAMERICAN", "ARCA", "BATS", "OTC", "OTCMKTS", "US"]);
  const CCY = /^(USD|EUR|GBP|JPY|CHF|AUD|CAD|NZD|SEK|NOK|DKK|PLN|HUF|CZK|MXN|ZAR|TRY|SGD|HKD|CNH|CNY|INR){2}$/;

  // Commodities, indices and a few crypto names -> Yahoo symbols. Keys are upper-case, letters/digits only.
  const ALIAS = {};
  const alias = (y, keys) => keys.split(" ").forEach((k) => (ALIAS[k] = y));
  alias("GC=F", "GOLD XAUUSD GOLDSPOT GOLDFUTURES");
  alias("SI=F", "SILVER XAGUSD SILVERSPOT");
  alias("PL=F", "PLATINUM XPTUSD"); alias("PA=F", "PALLADIUM XPDUSD"); alias("HG=F", "COPPER XCUUSD");
  alias("CL=F", "OIL CRUDEOIL CRUDE USOIL WTI WTICRUDE WTIOIL USCRUDE OILWTI CRUDEOILWTI WTICRUDEOIL LIGHTCRUDE");
  alias("BZ=F", "BRENT UKOIL BRENTOIL BRENTCRUDE OILBRENT BRENTCRUDEOIL");
  alias("NG=F", "NATURALGAS NATGAS NGAS GAS"); alias("RB=F", "GASOLINE"); alias("HO=F", "HEATINGOIL");
  alias("ZC=F", "CORN"); alias("ZW=F", "WHEAT"); alias("ZS=F", "SOYBEANS SOYBEAN"); alias("KC=F", "COFFEE");
  alias("SB=F", "SUGAR"); alias("CC=F", "COCOA"); alias("CT=F", "COTTON");
  alias("^GSPC", "SPX INX SP500 SPX500 US500 USA500 SPX500USD USSPX500 SP500INDEX");
  alias("^NDX", "NDX NAS100 NASDAQ100 US100 USTECH100 USTECH USATECH100 NAS100USD TECH100 NQ100 USNDAQ100");
  alias("^DJI", "DJI DJIA US30 USA30 DJ30 DOWJONES DOWJONES30 WALLSTREET WALLSTREET30 US30USD DOWJONESINDUSTRIALAVERAGE");
  alias("^RUT", "RUT US2000 RUSSELL2000 SMALLCAP2000 USSMALLCAP2000"); alias("^IXIC", "IXIC NASDAQCOMPOSITE");
  alias("^VIX", "VIX VOLATILITYSP500 VOLATILITYINDEX");
  alias("^GDAXI", "DAX DAX40 GER40 GER30 DE40 DE30 GERMANY40 GERMANY30 DEU40");
  alias("^FTSE", "FTSE FTSE100 UK100 UKX"); alias("^FCHI", "CAC40 FRA40 FRANCE40 PX1");
  alias("^N225", "NIKKEI NIKKEI225 JP225 JPN225 NI225 JAPAN225 JAPANNI225"); alias("^HSI", "HSI HK50 HANGSENG HONGKONG50 HKG33");
  alias("^STOXX50E", "STOXX50 EU50 EUSTX50 EUROSTOXX50 EUROPE50 SX5E"); alias("^AXJO", "ASX200 AUS200 AUSTRALIA200 SPASX200");
  alias("^IBEX", "IBEX35 ESP35 SPAIN35 IBEX"); alias("^SSMI", "SMI SWI20 SWISS20 SWITZERLAND20");
  alias("^AEX", "AEX NL25 NETHERLANDS25"); alias("DX-Y.NYB", "DXY USDX USDOLLARINDEX DOLLARINDEX USDINDEX");
  alias("BTC-USD", "BITCOIN"); alias("ETH-USD", "ETHEREUM");

  // Free-text / broker code -> commodity, index or forex pair (null if it is none of those).
  function resolveLoose(text) {
    const key = String(text).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return ALIAS[key] || (CCY.test(key) ? key + "=X" : null);
  }

  // loose = the symbol may be a commodity / index / forex name rather than a stock ticker.
  function toYahoo(sym, exch, loose) {
    if (!sym) return null;
    try { sym = decodeURIComponent(sym); } catch (e) {}
    sym = sym.toUpperCase().trim();
    exch = (exch || "").toUpperCase();
    if (exch && !STOCK_EX.has(exch)) loose = true;
    let m;
    if ((m = sym.match(/^([A-Z]{1,3})[12]!$/))) return m[1] + "=F"; // TradingView continuous futures, GC1! -> GC=F
    if (loose) { const r = resolveLoose(sym.replace(/^[.#@]/, "")); if (r) return r; }
    if (!/^[A-Z0-9.\-^=!_]{1,15}$/.test(sym)) return null;
    sym = sym.replace(/!$/, "");
    const cr = sym.match(/^([A-Z0-9]{2,6}?)(USDT|USDC|USD)$/);
    if (cr && (CRYPTO_EX.has(exch) || /^(BTC|ETH|SOL|XRP|DOGE|ADA|BNB|LTC|AVAX|LINK|DOT|SHIB|TRX)$/.test(cr[1]))) return cr[1] + "-USD";
    sym = sym.replace(/^([A-Z]+)[./]([A-Z])$/, "$1-$2"); // BRK.B -> BRK-B
    return sym + (SUFFIX[exch] || "");
  }

  // [hostname test, function(URL) -> yahoo symbol | null]
  const RULES = [
    [/finance\.yahoo\.com$/, (u) => { const m = u.pathname.match(/^\/(?:quote|chart)\/([^/]+)/); return m ? decodeURIComponent(m[1]).toUpperCase() : null; }],
    [/tradingview\.com$/, (u) => {
      let s = u.searchParams.get("symbol") || u.searchParams.get("tvwidgetsymbol");
      const p = u.pathname.match(/^\/symbols\/([^/]+)/);
      if (!s && p) s = p[1].includes("-") ? p[1].replace("-", ":") : p[1];
      if (!s) { const t = document.title.match(/^([A-Z0-9.!_]{1,15}) [\d,.]+ [▲▼]/); if (t) s = t[1]; }
      if (!s) return null;
      const [a, b] = decodeURIComponent(s).split(":");
      return b ? toYahoo(b, a) : toYahoo(a, "", true);
    }],
    [/google\.com$/, (u) => { const m = u.pathname.match(/\/finance\/quote\/([^:/]+)(?::([^/?]+))?/); return m ? toYahoo(m[1].replace(/^\./, ""), m[2], !m[2]) : null; }],
    [/marketwatch\.com$/, (u) => path(u, /\/investing\/(?:index|currency)\/([^/?]+)/, true) || path(u, /\/investing\/(?:stock|fund|cryptocurrency)\/([^/?]+)/)],
    [/investing\.com$/, (u) => path(u, /^\/(?:currencies|commodities|indices|crypto)\/([^/?]+)/, true)],
    [/finviz\.com$/, (u) => toYahoo(u.searchParams.get("t"))],
    [/stockanalysis\.com$/, (u) => path(u, /^\/(?:stocks|etf)\/([^/]+)/)],
    [/seekingalpha\.com$/, (u) => path(u, /^\/symbol\/([^/]+)/)],
    [/cnbc\.com$/, (u) => {
      let m = u.pathname.match(/^\/quotes\/([^/?]+)/); if (!m) return null;
      const s = decodeURIComponent(m[1]).toUpperCase();
      if ((m = s.match(/^@([A-Z]{1,3})\.\d$/))) return m[1] + "=F";      // @GC.1 -> gold futures
      if ((m = s.match(/^([A-Z]{3})=$/))) return m[1] + "USD=X";           // EUR= -> EURUSD
      if ((m = s.match(/^([A-Z]{6})=$/))) return m[1] + "=X";
      return toYahoo(s.replace(/^\./, ""), "", s[0] === ".");
    }],
    [/robinhood\.com$/, (u) => path(u, /^\/(?:[a-z]{2}\/[a-z]{2}\/)?stocks\/([^/]+)/) || (path(u, /\/crypto\/([^/]+)/) ? path(u, /\/crypto\/([^/]+)/) + "-USD" : null)],
    [/webull\.com$/, (u) => path(u, /\/quote\/[a-z]+-([^/?]+)/)],
    [/nasdaq\.com$/, (u) => path(u, /\/market-activity\/(?:stocks|etf|funds-and-etfs)\/([^/]+)/)],
    [/barchart\.com$/, (u) => path(u, /\/(?:stocks|etfs-funds)\/quotes\/([^/]+)/)],
    [/bloomberg\.com$/, (u) => { const m = u.pathname.match(/\/quote\/([^:/]+):US/i); return m ? toYahoo(m[1]) : null; }],
    [/tipranks\.com$/, (u) => path(u, /\/(?:stocks|etf)\/([^/]+)/)],
    [/stocktwits\.com$/, (u) => path(u, /\/symbol\/([^/]+)/)],
    [/morningstar\.com$/, (u) => path(u, /\/(?:stocks|etfs)\/[a-z]+\/([^/]+)/)],
    [/fool\.com$/, (u) => path(u, /\/quote\/[a-z]+\/([^/]+)/)],
    [/zacks\.com$/, (u) => path(u, /\/stock\/(?:quote|research|chart)\/([^/?]+)/)],
    [/marketbeat\.com$/, (u) => path(u, /\/stocks\/[A-Za-z]+\/([^/]+)/)],
    [/wsj\.com$/, (u) => path(u, /\/market-data\/quotes\/([^/?]+)/)],
    [/benzinga\.com$/, (u) => path(u, /\/quote\/([^/?]+)/)],
    [/etoro\.com$/, (u) => path(u, /\/markets\/([^/?]+)/)],
    [/stockcharts\.com$/, (u) => toYahoo(u.searchParams.get("s"))],
    [/macrotrends\.net$/, (u) => path(u, /\/stocks\/charts\/([^/]+)/)],
    [/nyse\.com$/, (u) => path(u, /\/quote\/[A-Z]+:([^/?]+)/)],
  ];
  function path(u, re, loose) { const m = u.pathname.match(re); return m ? toYahoo(m[1], "", loose) : null; }

  // Trading 212 instrument codes: AAPL_US_EQ, VODl_EQ (London), SAPd_EQ (Xetra) ...
  const T212_SUFFIX = { l: ".L", d: ".DE", p: ".PA", a: ".AS", m: ".MI", e: ".MC", s: ".SW" };
  function t212ToYahoo(code) {
    let m;
    if ((m = code.match(/^(.+)_US_EQ$/))) return toYahoo(m[1]);
    if ((m = code.match(/^(.+?)([a-z])_EQ$/))) { const s = toYahoo(m[1]); return s && s + (T212_SUFFIX[m[2]] || ""); }
    if ((m = code.match(/^(.+?)_(?:[A-Z]{2}_)?EQ$/))) return toYahoo(m[1]);
    return toYahoo(code.replace(/^#/, ""), "", true);
  }
  const hasRule = RULES.some(([re]) => re.test(location.hostname));
  const STOP = new Set("BUY SELL USD EUR GBP CFD ISA ETF NEW ALL TOP FAQ HELP OK PRO MAX MIN AVG NAV PE EPS AM PM YTD LIVE DEMO OPEN HIGH LOW VOL CAP P L PIE PIES HOME MENU CLOSE EDIT ADD".split(" "));
  let lastTitle = null, lastSaved = null, ready = false, lastClick = 0, clickSeq = 0, tabSig = null;
  // The newest signal wins: a click, the open tab changing, a chart request, or the title.
  let hint = { sym: null, src: "", t: 0 };
  function setHint(sym, src) {
    if (!sym) return;
    hint = { sym, src, t: Date.now() };
    tick();
  }
  // Company name -> ticker lookups (cached; Yahoo search in the background script).
  const nameCache = new Map();
  // Well-known brand names whose ticker can't be found from the company's legal name.
  const BRAND = { spacex: "SPCX", google: "GOOGL", alphabet: "GOOGL", facebook: "META", "meta platforms": "META",
    "berkshire hathaway": "BRK-B", amazon: "AMZN", "amazon.com": "AMZN", netflix: "NFLX", nvidia: "NVDA", tesla: "TSLA",
    apple: "AAPL", microsoft: "MSFT", "advanced micro devices": "AMD", amd: "AMD", palantir: "PLTR", "take-two interactive software": "TTWO" };
  function lookupName(name, strict) {
    const key = name.toLowerCase().replace(/,?\s+(inc|corp|corporation|plc|ltd|co|company|holdings|group)\.?$/i, "").trim();
    if (BRAND[key]) return Promise.resolve(BRAND[key]);
    if (nameCache.has(key)) return Promise.resolve(nameCache.get(key));
    return browser.runtime.sendMessage({ type: "search", q: name, strict }).then((s) => { nameCache.set(key, s || null); return s; }).catch(() => null);
  }
  // Text on screen (a tab, a row, a header) -> ticker, or a name to look up.
  function parseLabel(text) {
    for (const part of String(text).split(/[\n·|•()×✕✖✓★☆▲▼↑↓→←]/)) {
      const w = part.replace(/^[^A-Za-z0-9#^]+|[^A-Za-z0-9.%$€£]+$/g, "").trim();
      if (!w || UI_WORD.test(w)) continue;
      const loose = resolveLoose(w);
      if (loose) return { sym: loose };
      if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(w) && !STOP.has(w)) return { sym: toYahoo(w) };
      const nm = w.replace(/\s*[+\-−]?[\d$€£][\d.,%\s$€£+\-−]*$/, ""); // drop a trailing price / % change
      if (/^[A-Za-z][A-Za-z0-9 .,&'\-]{2,45}$/.test(nm) && /[A-Za-z]{3}/.test(nm) && !/\d{2}/.test(nm)) return { name: nm };
    }
    return null;
  }
  function resolveLabel(text, src, seq) {
    const p = parseLabel(text);
    if (!p) return false;
    if (p.sym) { setHint(p.sym, src); return true; }
    lookupName(p.name, true).then((s) => { if (s && (seq === undefined || seq === clickSeq)) setHint(s, src); });
    return true;
  }

  function detect() {
    const u = new URL(location.href);
    for (const [re, fn] of RULES) {
      if (re.test(u.hostname)) { try { const s = fn(u); if (s) return s; } catch (e) {} break; }
    }
    // Generic fallback: "Apple Inc. (AAPL)" style page titles.
    const t = document.title.match(/\(([A-Z]{1,5}(?:[.\-][A-Z])?)\)/);
    return t ? toYahoo(t[1]) : null;
  }

  // ---------- UI (shadow DOM so site styles can't touch it) ----------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;top:80px;right:16px;z-index:2147483647;display:none;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      .p{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:1px;padding:5px;width:282px;box-sizing:border-box;
         border-radius:14px;overflow:hidden;font:15px/1 Arial,Helvetica,sans-serif;color:#fff;cursor:move;user-select:none;
         background:linear-gradient(145deg,rgba(40,60,110,.30),rgba(6,11,28,.40) 55%,rgba(10,18,44,.36));
         backdrop-filter:blur(10px) saturate(170%);
         border:1px solid rgba(255,255,255,.22);
         box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 0 rgba(255,255,255,.06)}
      .p::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
         background:radial-gradient(120% 60% at 15% -10%,rgba(255,255,255,.22),transparent 55%),
                    radial-gradient(90% 50% at 110% 110%,rgba(120,160,255,.14),transparent 60%)}
      .c{position:relative;background:rgba(5,10,26,.30);height:29px;display:flex;align-items:center;justify-content:center;
         white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.45);transition:background .25s}
      .c:nth-child(1){border-top-left-radius:9px}.c:nth-child(2){border-top-right-radius:9px}
      .f{grid-column:1/3;gap:6px;border-radius:0 0 9px 9px}
      .f span{cursor:pointer}.f span:hover{text-decoration:underline}
    </style>
    <div class="p">
      <div class="c">Trend</div><div class="c" id="trend">…</div>
      <div class="c">Strength:</div><div class="c" id="strength">…</div>
      <div class="c">Momentum</div><div class="c" id="momentum">…</div>
      <div class="c">Volatility</div><div class="c" id="volatility">…</div>
      <div class="c">Volume</div><div class="c" id="volume">…</div>
      <div class="c">Close : EMA</div><div class="c" id="closeEma">…</div>
      <div class="c">Consolidation</div><div class="c" id="consolidation">…</div>
      <div class="c">Machine Learning</div><div class="c" id="ml">…</div>
      <div class="c f"><span id="sym" title="Click to change ticker"></span>·<span id="tf" title="Click to change timeframe"></span></div>
    </div>`;
  const $ = (id) => shadow.getElementById(id);
  (document.body || document.documentElement).appendChild(host);

  let pending = false, symbol = null, manual = false, interval = "5m", everOk = false, lastAuto, timer = null, busy = false;

  function set(id, text, color) { const el = $(id); el.textContent = text; el.style.background = color || ""; }
  function render(a) {
    set("trend", a.trend, a.trend === "Long" ? GREEN : RED);
    set("strength", a.strength.toFixed(a.strength < 1 ? 2 : 1) + "%");
    set("momentum", a.momentum, a.momentum === "Bullish" ? GREEN : a.momentum === "Bearish" ? RED : "");
    set("volatility", a.volatility);
    set("volume", a.volume);
    set("closeEma", a.closeEma, a.closeEma === "Above" ? GREEN : RED);
    set("consolidation", a.consolidation);
    set("ml", a.ml == null ? "n/a" : Math.round(a.ml) + "%");
  }
  function blank() { ["trend", "strength", "momentum", "volatility", "volume", "closeEma", "consolidation", "ml"].forEach((id) => set(id, "…")); }

  async function refresh() {
    if (!symbol || document.hidden) return;
    if (busy) { pending = true; return; } // instrument changed mid-load: run again when done
    busy = true; pending = false;
    const want = symbol + interval;
    try {
      const res = await browser.runtime.sendMessage({ type: "bars", symbol, interval });
      if (want !== symbol + interval) return;
      if (res && res.ok) {
        everOk = true;
        render(STP.analyse(res.bars));
        $("sym").textContent = symbol; $("tf").textContent = interval;
        host.style.display = "block";
        if (symbol !== lastSaved) { lastSaved = symbol; browser.storage.local.set({ last: symbol }); }
      } else if (!everOk) {
        $("sym").textContent = symbol + " (no data)";
      }
    } catch (e) { /* keep last values */ } finally { busy = false; if (pending) { pending = false; refresh(); } }
  }

  function start(sym, isManual) {
    symbol = sym; manual = !!isManual; everOk = false; blank();
    host.style.display = "block";
    $("sym").textContent = sym || "waiting for ticker…"; $("tf").textContent = interval;
    if (!sym) return;
    schedule(); refresh();
  }
  function schedule() {
    clearInterval(timer);
    timer = setInterval(refresh, interval === "1m" || interval === "5m" ? 10000 : 30000);
  }

  // Re-detect every second: URL / title first, then hints from the app's network
  // requests, the last instrument clicked, or the page title looked up by name.
  // A manually typed ticker stays until the automatically detected one changes.
  const UI_WORD = /^(stocks?|indices|forex|commodities|crypto|etfs?|most traded|top movers|new on|trending|gainers|losers|feed|see all|follow|indicators|buy|sell|deposit|withdraw|search|settings|menu|history|orders?|positions?|portfolio|home|invest|cancel|confirm|close|help|log ?out|log ?in|watchlists?|market|limit|stop|value|quantity|price|charts?|details|news|about|more|free funds|account|pies?|discover|community|today|all|popular|new|edit|add|remove|practice|real|loading)\b/i;
  function tick() {
    if (!ready) return;
    if (!hasRule && document.title !== lastTitle) {
      lastTitle = document.title;
      const name = lastTitle.replace(/trading\s*212/ig, "").replace(/[|\-–—:•·]+/g, " ").replace(/\s+/g, " ").trim();
        const loose = resolveLoose(name);
      if (loose) setHint(loose, "title");
      else if (name.length >= 3 && !UI_WORD.test(name) && !/^stocks isa/i.test(name)) {
        const t0 = lastTitle;
        lookupName(name, false).then((s) => { if (document.title === t0 && s) setHint(s, "title"); });
      }
    }
    if (!hasRule) watchActiveTab();
    // Nothing detected on this page -> keep showing the last instrument you looked at.
    const a = detect() || hint.sym || lastSaved || null;
    if (a !== lastAuto) { lastAuto = a; start(a, false); }
  }

  // Apps like Trading 212 mark the open instrument tab as selected/active: follow it.
  const ACTIVE_SEL = '[aria-selected="true"],[aria-current="page"],[aria-current="true"],[aria-pressed="true"],[class*="active" i],[class*="selected" i],[class*="current" i]';
  function watchActiveTab() {
    const found = [];
    for (const el of document.querySelectorAll(ACTIVE_SEL)) {
      if (found.length > 12 || el === host) continue;
      const t = (el.innerText || "").trim();
      if (t.length < 2 || t.length > 60 || t.split("\n").length > 3) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.top > innerHeight * 0.5) continue;
      const p = parseLabel(t);
      if (p) found.push(p.sym || p.name);
    }
    const sig = found.join("|");
    if (sig === tabSig) return;
    const prev = tabSig ? new Set(tabSig.split("|")) : new Set();
    tabSig = sig;
    const changed = found.filter((x) => !prev.has(x));
    if (!changed.length || (prev.size === 0 && hint.sym)) return;
    const symLike = (x) => /[=^]|^[A-Z.\-]{1,8}$/.test(x);
    const pick = changed.find(symLike) || changed[0];
    if (symLike(pick)) setHint(pick, "tab");
    else lookupName(pick, true).then((s) => { if (s && tabSig === sig) setHint(s, "tab"); });
  }

  setInterval(tick, 500);
  const soon = () => { setTimeout(tick, 60); setTimeout(tick, 400); setTimeout(tick, 1200); };
  window.addEventListener("popstate", soon); window.addEventListener("hashchange", soon);

  browser.runtime.sendMessage({ type: "hint?" }).then((code) => { if (code && !hint.sym) setHint(t212ToYahoo(code), "net"); }).catch(() => {});

  // Every click may be a navigation: re-detect right away. On apps without the ticker
  // in the URL, also read the instrument from the row that was clicked.
  function onPress(e) {
    soon();
    if (hasRule || e.composedPath().includes(host)) return;
    lastClick = Date.now();
    const seq = ++clickSeq;
    let el = e.target;
    for (let i = 0; i < 5 && el && el.innerText !== undefined; i++, el = el.parentElement) {
      const t = (el.innerText || "").trim();
      if (t.length > 160) break;
      if (t && resolveLabel(t, "click", seq)) return;
    }
  }
  // Capture phase on window, so the app can't swallow the event first.
  window.addEventListener("pointerdown", onPress, true);
  window.addEventListener("keyup", (e) => { if (e.key === "Enter") soon(); }, true);

  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  function ask() {
    const s = prompt("Ticker (Yahoo Finance format, e.g. AAPL, BTC-USD, VOD.L, EURUSD=X):", symbol || "");
    if (s && s.trim()) start(s.trim().toUpperCase(), true);
  }
  $("sym").addEventListener("click", async (e) => {
    if (!e.shiftKey) return ask();
    // Shift+click: copy detection diagnostics (no account data) for troubleshooting.
    const log = await browser.runtime.sendMessage({ type: "log?" }).catch(() => []);
    const tabs = [...document.querySelectorAll(ACTIVE_SEL)].slice(0, 25).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 80), text: (el.innerText || "").trim().slice(0, 60) }));
    const info = { host: location.hostname, path: location.pathname, title: document.title, symbol, hint, tabSig, active: tabs, requests: log };
    navigator.clipboard.writeText(JSON.stringify(info, null, 1)).then(() => { $("sym").textContent = "copied"; setTimeout(() => { $("sym").textContent = symbol || "?"; }, 1200); });
  });
  $("tf").addEventListener("click", () => {
    interval = INTERVALS[(INTERVALS.indexOf(interval) + 1) % INTERVALS.length];
    $("tf").textContent = interval; blank(); schedule();
    browser.storage.local.set({ interval }); refresh();
  });
  browser.runtime.onMessage.addListener((m) => {
    if (m && m.type === "prompt") ask();
    // Instrument code seen in the app's own data requests. Trust chart requests, and any
    // single-instrument request made right after a click.
    if (m && m.type === "sniff" && (m.chart || Date.now() - lastClick < 4000)) setHint(t212ToYahoo(m.code), "net");
  });

  // Drag to move; position is remembered.
  let drag = null;
  host.addEventListener("pointerdown", (e) => {
    const r = host.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return; drag.moved = true;
    const x = Math.max(0, Math.min(innerWidth - 60, e.clientX - drag.dx)), y = Math.max(0, Math.min(innerHeight - 30, e.clientY - drag.dy));
    host.style.left = x + "px"; host.style.top = y + "px"; host.style.right = "auto";
  }, true);
  window.addEventListener("pointerup", () => {
    if (drag && drag.moved) browser.storage.local.set({ pos: { left: host.style.left, top: host.style.top } });
    drag = null;
  }, true);

  browser.storage.local.get(["interval", "pos", "last"]).then((s) => {
    if (s.last) lastSaved = s.last;
    if (INTERVALS.includes(s.interval)) interval = s.interval;
    if (s.pos) { host.style.left = s.pos.left; host.style.top = s.pos.top; host.style.right = "auto"; }
  }).catch(() => {}).finally(() => { ready = true; tick(); });
})();
