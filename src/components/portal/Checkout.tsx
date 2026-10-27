import { useState } from "react";
import { Upload } from "lucide-react";
import { Button, CopyButton, Field, Note, inputCls, useAction } from "./ui";
import { propApi } from "@/lib/propApi";
import { money } from "@/lib/portal";
import { trackPixel } from "@/lib/metaPixel";

/** Firm deposit wallets for manual "Crypto QR" payments. Set the VITE_WALLET_* env vars. */
export const WALLETS = [
  { id: "USDT_TRC20", label: "USDT · TRC20", address: import.meta.env["VITE_WALLET_USDT_TRC20"] as string | undefined },
  { id: "USDT_BEP20", label: "USDT · BEP20", address: import.meta.env["VITE_WALLET_USDT_BEP20"] as string | undefined },
  { id: "USDT_ERC20", label: "USDT · ERC20", address: import.meta.env["VITE_WALLET_USDT_ERC20"] as string | undefined },
  { id: "USDT_POLYGON", label: "USDT · Polygon", address: import.meta.env["VITE_WALLET_USDT_POLYGON"] as string | undefined },
  { id: "BTC", label: "Bitcoin", address: import.meta.env["VITE_WALLET_BTC"] as string | undefined },
  { id: "SOL", label: "Solana", address: import.meta.env["VITE_WALLET_SOL"] as string | undefined },
];

/** Payment step for an existing order: redirect to the card gateway, or upload a crypto transfer proof. */
export function PayOrder({ orderId, amount, paymentMethod, platform = "MT5", onDone }: { orderId: string; amount: number; paymentMethod: string; platform?: "MT5" | "MT4" | "cTrader"; onDone?: () => void }) {
  const manual = paymentMethod.toLowerCase().includes("crypto qr");
  const [wallet, setWallet] = useState(WALLETS[0]!.id);
  const [txid, setTxid] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { busy, note, run } = useAction();
  const w = WALLETS.find((x) => x.id === wallet)!;

  if (!manual) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">You will be redirected to our secure payment partner to pay <strong className="text-foreground">{money(amount)}</strong>.</p>
        <Button
          variant="primary"
          busy={busy === "pay"}
          onClick={() => run("pay", async () => {
            trackPixel("AddPaymentInfo", {
              content_name: `Order ${orderId}`,
              value: amount,
              currency: "USD",
              payment_method: paymentMethod,
            });
            const { checkoutUrl } = await propApi.orders.pay(orderId, platform);
            window.location.href = checkoutUrl;
          })}
        >
          Continue to payment
        </Button>
        {note && <Note tone={note.tone}>{note.text}</Note>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Send exactly <strong className="text-foreground">{money(amount)}</strong> to the wallet below, then upload your transaction ID and a screenshot. Your account is activated after we confirm the transfer.</p>
      <Field label="Network">
        <select value={wallet} onChange={(e) => setWallet(e.target.value)} className={inputCls}>
          {WALLETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </Field>
      <div className="rounded-xl bg-background p-4">
        <p className="text-[11px] text-muted-foreground">Deposit address</p>
        {w.address ? (
          <p className="mt-1 flex items-center gap-2 font-mono text-sm break-all">{w.address}<CopyButton value={w.address} label="Copy address" /></p>
        ) : (
          <p className="mt-1 text-sm text-amber-500">Wallet not configured — set VITE_WALLET_{w.id} in the environment.</p>
        )}
      </div>
      <Field label="Transaction ID (TXID)"><input value={txid} onChange={(e) => setTxid(e.target.value)} className={inputCls} placeholder="Paste the transaction hash" /></Field>
      <Field label="Payment screenshot" hint="PNG, JPG or WEBP, up to 5 MB">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/15 px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/50">
          <Upload className="h-4 w-4" />{file ? file.name : "Choose file"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </Field>
      <Button
        variant="primary"
        disabled={!txid || !file}
        busy={busy === "proof"}
        onClick={async () => {
          trackPixel("AddPaymentInfo", {
            content_name: `Order ${orderId}`,
            value: amount,
            currency: "USD",
            payment_method: "Crypto QR",
          });
          const ok = await run("proof", () => propApi.orders.submitManualPayment({ orderId, walletId: wallet, txid: txid.trim(), screenshot: file! }), "Payment proof submitted. We will confirm it shortly.");
          if (ok) {
            trackPixel("Purchase", {
              content_name: `Order ${orderId}`,
              value: amount,
              currency: "USD",
              num_items: 1,
            });
            onDone?.();
          }
        }}
      >
        Submit payment proof
      </Button>
      {note && <Note tone={note.tone}>{note.text}</Note>}
    </div>
  );
}
