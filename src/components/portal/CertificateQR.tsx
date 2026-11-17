import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Public URL that verifies a certificate (scanned from the QR code). */
export function certificateVerifyUrl(id: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/certificates/${encodeURIComponent(id)}`;
}

/** QR code linking to the public verification page for a certificate. */
export function CertificateQR({ id, size = 96, className = "" }: { id: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(certificateVerifyUrl(id), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b1530", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => { alive = false; };
  }, [id]);
  return (
    <a
      href={`/certificates/${encodeURIComponent(id)}`}
      target="_blank"
      rel="noreferrer"
      title="Scan or click to verify"
      className={`block shrink-0 overflow-hidden rounded-lg bg-white p-1 ${className}`}
      style={{ width: size, height: size }}
    >
      {svg ? <span className="block h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="block h-full w-full animate-pulse bg-black/10" />}
    </a>
  );
}
