import { useSyncExternalStore } from "react";

/**
 * Live market quotes shared by the ticker, trading terminal and markets table.
 *
 * - Crypto and gold (via PAXG) stream in real time from Binance's public websocket.
 * - Other FX pairs start from the latest ECB reference rate (Frankfurter) and then tick
 *   with small simulated moves; indices and oil are simulated around a seed price.
 *   Swap `startSimulation` for a paid feed (Twelve Data, Finnhub, etc.) to make them fully live.
 */

export type AssetClass = "Forex" | "Metals" | "Indices" | "Crypto" | "Energy";

export type Asset = {
  symbol: string;
  name: string;
  cls: AssetClass;
  decimals: number;
  seed: number;
  /** Binance stream symbol, when the asset is streamed live. */
  binance?: string;
  /** Units per 1.0 lot, used for P&L in the trading demo. */
  contract: number;
  leverage: string;
  spread: string;
};

export const assets: Asset[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", cls: "Forex", decimals: 5, seed: 1.123, contract: 100000, leverage: "1:100", spread: "0.1 pips" },
  { symbol: "GBP/USD", name: "British Pound / US Dollar", cls: "Forex", decimals: 5, seed: 1.34, contract: 100000, leverage: "1:100", spread: "0.3 pips" },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen", cls: "Forex", decimals: 3, seed: 157.9, contract: 100000, leverage: "1:100", spread: "0.2 pips" },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar", cls: "Forex", decimals: 5, seed: 0.703, contract: 100000, leverage: "1:100", spread: "0.3 pips" },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar", cls: "Forex", decimals: 5, seed: 1.405, contract: 100000, leverage: "1:100", spread: "0.4 pips" },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc", cls: "Forex", decimals: 5, seed: 0.824, contract: 100000, leverage: "1:100", spread: "0.4 pips" },
  { symbol: "XAU/USD", name: "Gold Spot", cls: "Metals", decimals: 2, seed: 4100, binance: "paxgusdt", contract: 100, leverage: "1:50", spread: "$0.12" },
  { symbol: "US30", name: "Dow Jones 30", cls: "Indices", decimals: 1, seed: 46000, contract: 1, leverage: "1:20", spread: "1.2 pts" },
  { symbol: "NAS100", name: "Nasdaq 100", cls: "Indices", decimals: 1, seed: 25000, contract: 1, leverage: "1:20", spread: "0.8 pts" },
  { symbol: "SPX500", name: "S&P 500", cls: "Indices", decimals: 1, seed: 6700, contract: 1, leverage: "1:20", spread: "0.4 pts" },
  { symbol: "WTI", name: "Crude Oil", cls: "Energy", decimals: 2, seed: 62, contract: 1000, leverage: "1:20", spread: "$0.03" },
  { symbol: "BTC/USD", name: "Bitcoin", cls: "Crypto", decimals: 2, seed: 83000, binance: "btcusdt", contract: 1, leverage: "1:2", spread: "$12" },
  { symbol: "ETH/USD", name: "Ethereum", cls: "Crypto", decimals: 2, seed: 2450, binance: "ethusdt", contract: 1, leverage: "1:2", spread: "$1.2" },
  { symbol: "SOL/USD", name: "Solana", cls: "Crypto", decimals: 2, seed: 105, binance: "solusdt", contract: 1, leverage: "1:2", spread: "$0.08" },
  { symbol: "BNB/USD", name: "BNB", cls: "Crypto", decimals: 2, seed: 740, binance: "bnbusdt", contract: 1, leverage: "1:2", spread: "$0.4" },
  { symbol: "XRP/USD", name: "XRP", cls: "Crypto", decimals: 4, seed: 1.34, binance: "xrpusdt", contract: 1, leverage: "1:2", spread: "$0.002" },
];

const bySymbol = new Map(assets.map((a) => [a.symbol, a]));
export const getAsset = (symbol: string): Asset => bySymbol.get(symbol) ?? assets[0]!;

export type Quote = {
  price: number;
  /** Reference price for the change % (24h open for streamed assets). */
  open: number;
  /** +1 / -1 for the direction of the last tick, used for the flash colour. */
  dir: 1 | -1 | 0;
  live: boolean;
  /** False until the first real price (stream or reference rate) has arrived. */
  ready: boolean;
};
export type Quotes = Record<string, Quote>;

/** Formats a price with the asset's decimals and thousands separators. */
export const fmtPrice = (symbol: string, price: number) => {
  const d = getAsset(symbol).decimals;
  return price.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
export const getQuote = (quotes: Quotes, symbol: string): Quote => quotes[symbol] ?? serverSnapshot[symbol]!;
export const changePct = (q: Quote) => (q.open ? ((q.price - q.open) / q.open) * 100 : 0);

/* ---------------- store ---------------- */

const seedQuotes = (): Quotes =>
  Object.fromEntries(assets.map((a) => [a.symbol, { price: a.seed, open: a.seed * (1 - (Math.random() - 0.45) * 0.01), dir: 0, live: false, ready: !a.binance && a.cls !== "Forex" }]));

const serverSnapshot: Quotes = Object.fromEntries(assets.map((a) => [a.symbol, { price: a.seed, open: a.seed, dir: 0, live: false, ready: false }]));

let snapshot: Quotes = serverSnapshot;
const listeners = new Set<() => void>();
let started = false;
let stopFeeds: (() => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setQuote(symbol: string, patch: Partial<Quote>) {
  const prev = snapshot[symbol]!;
  const next = { ...prev, ...patch };
  if (patch.price !== undefined && patch.price !== prev.price) next.dir = patch.price > prev.price ? 1 : -1;
  snapshot = { ...snapshot, [symbol]: next };
}

function startBinance() {
  const streamed = assets.filter((a) => a.binance);
  const bySymbol = Object.fromEntries(streamed.map((a) => [a.binance!.toUpperCase(), a.symbol]));
  const url = `wss://stream.binance.com:9443/stream?streams=${streamed.map((a) => `${a.binance}@miniTicker`).join("/")}`;
  let ws: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  const connect = () => {
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    ws.onmessage = (e) => {
      try {
        const { data } = JSON.parse(e.data as string) as { data: { s: string; c: string; o: string } };
        const sym = bySymbol[data.s];
        if (!sym) return;
        setQuote(sym, { price: parseFloat(data.c), open: parseFloat(data.o), live: true, ready: true });
        emit();
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => {
      if (!closed) retry = setTimeout(connect, 5000);
    };
  };
  connect();
  return () => {
    closed = true;
    clearTimeout(retry);
    ws?.close();
  };
}

async function loadFxReference() {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,AUD,CAD,CHF");
    const { rates } = (await res.json()) as { rates: Partial<Record<"EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "CHF", number>> };
    const set = (symbol: string, price: number | undefined) => {
      if (!price || !Number.isFinite(price) || snapshot[symbol]!.live) return;
      setQuote(symbol, { price, open: price * (1 - (Math.random() - 0.5) * 0.004), ready: true });
    };
    set("EUR/USD", rates.EUR && 1 / rates.EUR);
    set("GBP/USD", rates.GBP && 1 / rates.GBP);
    set("AUD/USD", rates.AUD && 1 / rates.AUD);
    set("USD/JPY", rates.JPY);
    set("USD/CAD", rates.CAD);
    set("USD/CHF", rates.CHF);
  } catch {
    /* keep seed prices */
  }
  for (const a of assets) if (a.cls === "Forex" && !snapshot[a.symbol]!.ready) setQuote(a.symbol, { ready: true });
  emit();
}

/** Small random-walk ticks for assets without a live stream (or while the stream is down). */
function startSimulation() {
  const id = setInterval(() => {
    let changed = false;
    for (const a of assets) {
      const q = snapshot[a.symbol]!;
      if (q.live || Math.random() < 0.35) continue;
      const vol = a.cls === "Forex" ? 0.00012 : a.cls === "Crypto" ? 0.0008 : 0.0004;
      setQuote(a.symbol, { price: q.price * (1 + (Math.random() - 0.5) * 2 * vol) });
      changed = true;
    }
    if (changed) emit();
  }, 1200);
  return () => clearInterval(id);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  snapshot = seedQuotes();
  const stops = [startBinance(), startSimulation()];
  void loadFxReference();
  stopFeeds = () => stops.forEach((s) => s());
}

function subscribe(l: () => void) {
  listeners.add(l);
  start();
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      stopFeeds?.();
      stopFeeds = null;
      started = false;
    }
  };
}

/** All live quotes; re-renders on every tick. */
export function useQuotes(): Quotes {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
}
