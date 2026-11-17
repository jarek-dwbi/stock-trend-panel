# Stock Trend Panel (Firefox extension)

A small live panel (Trend, Strength, Momentum, Volatility, Volume, Close : EMA,
Consolidation, Machine Learning) that appears automatically on stock, forex,
commodity and index pages and updates in real time using Yahoo Finance's free
chart data.

**Firefox Add-ons page:** https://addons.mozilla.org/en-US/firefox/addon/80411f2a404440c0805a/

## Supported sites
TradingView, Yahoo Finance, Google Finance, MarketWatch, Investing.com, Finviz,
Nasdaq, CNBC, Robinhood, Webull, Trading 212 and about 20 more (see `manifest.json`).

## Install (temporary)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `manifest.json`.

For a permanent install, upload a zip of these files to addons.mozilla.org as an
unlisted add-on and install the signed file.

## Using it
- The panel shows as soon as the page loads and follows whatever instrument you open.
- Click the ticker in the footer to type one manually; click the timeframe to cycle 1m / 5m / 15m / 1h / 1d.
- Drag the panel to move it; the position is remembered.
- Shift+click the ticker to copy detection diagnostics.

## How the rows are calculated
| Row | Calculation |
|---|---|
| Trend | EMA 20 vs EMA 50 |
| Strength | Gap between EMA 20 and EMA 50, in % |
| Momentum | MACD histogram and RSI 14 agreeing |
| Volatility | ATR 14 percentile over the last 200 bars |
| Volume | 5-bar vs 20-bar average volume |
| Close : EMA | Price vs EMA 200 |
| Consolidation | ADX 14 below 20 |
| Machine Learning | % of the 25 most similar past bars that rose over the next 4 bars |

Commodities use Yahoo futures prices (e.g. gold = `GC=F`). Data for some
exchanges is delayed. Not financial advice.
