/** Small inline brand-style badges for the crypto payment options. */

const Coin = ({ bg, title, children }: { bg: string; title: string; children: React.ReactNode }) => (
  <span title={title} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-black/10" style={{ background: bg }}>
    <svg viewBox="0 0 24 24" className="h-4 w-4">{children}</svg>
  </span>
);

export const BtcIcon = () => (
  <Coin bg="#F7931A" title="Bitcoin (BTC)">
    <text x="12" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="#fff">₿</text>
  </Coin>
);

export const UsdtIcon = () => (
  <Coin bg="#26A17B" title="Tether (USDT)">
    <path d="M6 6h12v2.6h-4.6v2c2.8.2 4.8.8 4.8 1.5s-2 1.3-4.8 1.5V19h-2.8v-5.4C7.8 13.4 5.8 12.8 5.8 12.1s2-1.3 4.8-1.5v-2H6V6Zm4.6 5.4c-2 .1-3.3.4-3.3.7 0 .4 2 .8 4.7.8s4.7-.4 4.7-.8c0-.3-1.3-.6-3.3-.7v1.3h-2.8v-1.3Z" fill="#fff" />
  </Coin>
);

export const EthIcon = () => (
  <Coin bg="#627EEA" title="Ethereum (ETH)">
    <path d="M12 3 6.5 12.2 12 15.4l5.5-3.2L12 3Z" fill="#fff" fillOpacity=".9" />
    <path d="M12 16.5 6.5 13.3 12 21l5.5-7.7-5.5 3.2Z" fill="#fff" />
  </Coin>
);

export const TronIcon = () => (
  <Coin bg="#EB0029" title="TRON (TRX)">
    <path d="M5 5.5 19 8.3l-7 10.7L5 5.5Zm2.2 1.6 4.6 9.2.5-6-5.1-3.2Zm6.3 3.2-.5 5.8 4.4-6.7-3.9.9Zm-4.6-2.7 4.4 2.7 3.3-.8-7.7-1.9Z" fill="#fff" />
  </Coin>
);

export const UsdcIcon = () => (
  <Coin bg="#2775CA" title="USD Coin (USDC)">
    <text x="12" y="16.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="13" fill="#fff">$</text>
    <circle cx="12" cy="12" r="8" fill="none" stroke="#fff" strokeWidth="1.3" strokeDasharray="9 3.6" />
  </Coin>
);

export const CryptoCoins = () => (
  <span className="flex flex-wrap items-center gap-1">
    <BtcIcon /><UsdtIcon /><EthIcon /><TronIcon /><UsdcIcon />
  </span>
);
