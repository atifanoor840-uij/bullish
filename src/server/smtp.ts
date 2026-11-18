/**
 * Minimal SMTP client (STARTTLS on 587 or implicit TLS on 465, AUTH LOGIN).
 * Runs on Cloudflare Workers (cloudflare:sockets) in production and on Node
 * (node:net / node:tls) during local development.
 */

export type SmtpConfig = { host: string; port: number; user: string; pass: string };
export type SmtpMessage = { from: string; to: string; subject: string; html: string };

type Conn = {
  write(data: string): Promise<void>;
  read(): Promise<string>;
  startTls(): Promise<void>;
  close(): void;
};

const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

async function openWorkers(host: string, port: number): Promise<Conn> {
  // Kept as a runtime specifier so Vite/Rolldown don't try to bundle the Workers built-in.
  const specifier = "cloudflare:sockets";
  const { connect } = (await import(/* @vite-ignore */ specifier)) as typeof import("cloudflare:sockets");
  let socket = connect({ hostname: host, port }, { secureTransport: port === 465 ? "on" : "starttls", allowHalfOpen: false });
  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  const enc = new TextEncoder(), dec = new TextDecoder();
  return {
    write: (d) => writer.write(enc.encode(d)),
    async read() {
      const { value, done } = await reader.read();
      if (done) throw new Error("SMTP connection closed");
      return dec.decode(value);
    },
    async startTls() {
      reader.releaseLock();
      writer.releaseLock();
      socket = socket.startTls();
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();
    },
    close: () => void socket.close().catch(() => {}),
  };
}

async function openNode(host: string, port: number): Promise<Conn> {
  const net = await import("node:net");
  const tls = await import("node:tls");
  type Sock = import("node:net").Socket;
  const chunks: string[] = [];
  let waiter: ((v: string) => void) | null = null;
  let failer: ((e: Error) => void) | null = null;
  const attach = (s: Sock) => {
    s.setEncoding("utf8");
    s.on("data", (d: string) => (waiter ? (waiter(d), (waiter = failer = null)) : chunks.push(d)));
    s.on("error", (e) => failer?.(e));
    s.on("close", () => failer?.(new Error("SMTP connection closed")));
  };
  const connectPlain = () => new Promise<Sock>((ok, ko) => { const s = net.connect(port, host, () => ok(s)); s.once("error", ko); });
  const connectTls = (opts: import("node:tls").ConnectionOptions) =>
    new Promise<Sock>((ok, ko) => { const s = tls.connect(opts, () => ok(s)); s.once("error", ko); });
  let sock = port === 465 ? await connectTls({ host, port, servername: host }) : await connectPlain();
  attach(sock);
  return {
    write: (d) => new Promise((ok, ko) => sock.write(d, (e) => (e ? ko(e) : ok()))),
    read: () => (chunks.length ? Promise.resolve(chunks.shift()!) : new Promise((ok, ko) => ((waiter = ok), (failer = ko)))),
    async startTls() {
      sock.removeAllListeners("data");
      sock = await connectTls({ socket: sock, servername: host });
      attach(sock);
    },
    close: () => sock.end(),
  };
}

/** Reads one full (possibly multi-line) SMTP reply and checks its status code. */
async function reply(conn: Conn, buf: { s: string }, expect: number[]) {
  for (;;) {
    const lines = buf.s.split("\r\n");
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i] ?? "";
      if (/^\d{3} /.test(line)) {
        const code = Number(line.slice(0, 3));
        const text = lines.slice(0, i + 1).join("\n");
        buf.s = lines.slice(i + 1).join("\r\n");
        if (!expect.includes(code)) throw new Error(`SMTP ${code}: ${text}`);
        return text;
      }
    }
    buf.s += await conn.read();
  }
}

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const addr = (s: string) => s.match(/<([^>]+)>/)?.[1] ?? s.trim();
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const fromHeader = (s: string) => {
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m && m[1] ? `${header(m[1])} <${m[2]}>` : addr(s);
};

function buildMessage(m: SmtpMessage, host: string) {
  const body = b64(m.html).replace(/.{76}/g, "$&\r\n");
  const domain = addr(m.from).split("@")[1] || host;
  return [
    `From: ${fromHeader(m.from)}`,
    `To: ${m.to}`,
    `Subject: ${header(m.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

/** Opens a session, authenticates, and either sends `message` or (when omitted) only verifies the login. */
export async function smtpSend(cfg: SmtpConfig, message?: SmtpMessage): Promise<void> {
  const conn = isWorkers ? await openWorkers(cfg.host, cfg.port) : await openNode(cfg.host, cfg.port);
  const buf = { s: "" };
  const cmd = async (line: string, expect: number[]) => { await conn.write(line + "\r\n"); return reply(conn, buf, expect); };
  try {
    await reply(conn, buf, [220]);
    await cmd("EHLO bullish4ex", [250]);
    if (cfg.port !== 465) {
      await cmd("STARTTLS", [220]);
      await conn.startTls();
      await cmd("EHLO bullish4ex", [250]);
    }
    await cmd("AUTH LOGIN", [334]);
    await cmd(b64(cfg.user), [334]);
    await cmd(b64(cfg.pass), [235]);
    if (message) {
      await cmd(`MAIL FROM:<${addr(message.from)}>`, [250]);
      await cmd(`RCPT TO:<${addr(message.to)}>`, [250, 251]);
      await cmd("DATA", [354]);
      const data = buildMessage(message, cfg.host).replace(/\r\n\./g, "\r\n..");
      await cmd(data + "\r\n.", [250]);
    }
    await cmd("QUIT", [221]).catch(() => {});
  } finally {
    conn.close();
  }
}
