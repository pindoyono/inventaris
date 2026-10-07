// Pemantau server & aplikasi (dipanggil timer tiap 5 menit). Mengirim email ke pengelola platform
// hanya saat ada masalah baru, masalah yang berlanjut (diingatkan tiap 6 jam), atau saat pulih.
// Jalankan: bun --conditions=react-server scripts/pantau.ts [--cek]   (--cek: tampilkan saja, tanpa email)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:tls";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { platformNotifyEmail, sendMailStrict } from "@/lib/server/mail";

const DRY = process.argv.includes("--cek");
const STATE = process.env.PANTAU_STATE ?? "/var/lib/inventaris/pantau.json";
const REMIND_MS = 6 * 3600_000;

/** Situs yang dipantau (status < 500 dianggap hidup; 3xx/4xx wajar untuk halaman yang butuh login) */
const SITES = [
  "https://inventaris.ankdev.id/login",
  "https://ankdev.id/",
  "https://e-vote.ankdev.id/",
  "https://guruwali.ankdev.id/",
  "https://erapor.smkn2malinau.sch.id/",
  "https://simak-pm.my.id/",
  "https://simpelsapakamu.id/",
  "https://gaple.ankdev.id/",
  "https://smkkaltara.id/",
  "https://skl.sman1malinau.ankdev.id/",
  "https://front.smkn2malinau.sch.id/",
  "https://absen.smkn2malinau.sch.id/",
];
const SERVICES = ["nginx", "postgresql", "mysql", "docker", "inventaris", "e-vote", "sigw", "gaplev2", "frontend-nextjs", "php8.3-fpm", "php8.4-fpm"];
const BACKUPS = ["inventaris-backup", "e-vote-backup", "sigw-backup"];

type Problems = Record<string, string>;
const problems: Problems = {};
const add = (key: string, msg: string) => (problems[key] = msg);

const sh = (cmd: string, args: string[]) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    return String((e as { stdout?: string }).stdout ?? "").trim();
  }
};

async function checkSites() {
  await Promise.all(
    SITES.map(async (u) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "inventaris-pantau" } });
          if (r.status < 500) return;
          if (attempt) add(`situs:${u}`, `${u} → HTTP ${r.status}`);
        } catch (e) {
          if (attempt) add(`situs:${u}`, `${u} tidak bisa dihubungi (${(e as Error).message})`);
        }
      }
    }),
  );
}

function checkServices() {
  for (const s of SERVICES) {
    const st = sh("systemctl", ["is-active", s]);
    if (st !== "active") add(`layanan:${s}`, `Layanan ${s} berstatus ${st || "tidak diketahui"}`);
  }
}

function checkBackups() {
  for (const u of BACKUPS) {
    const out = sh("systemctl", ["show", `${u}.service`, "--timestamp=unix", "-p", "Result", "-p", "ExecMainExitTimestamp"]);
    const result = /Result=(\S+)/.exec(out)?.[1];
    const ts = /ExecMainExitTimestamp=@(\d+)/.exec(out)?.[1];
    const t = ts ? Number(ts) * 1000 : NaN;
    if (result && result !== "success") add(`backup:${u}`, `Backup ${u} terakhir gagal (${result})`);
    else if (!ts || Number.isNaN(t) || Date.now() - t > 26 * 3600_000) add(`backup:${u}`, `Backup ${u} tidak berjalan dalam 26 jam terakhir (terakhir: ${ts ? new Date(t).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) : "belum pernah"})`);
  }
}

function checkDisk() {
  const line = sh("df", ["-P", "/"]).split("\n")[1] ?? "";
  const pct = Number(/(\d+)%/.exec(line)?.[1]);
  if (pct >= 85) add("disk:/", `Disk / terpakai ${pct}%`);
}

/** Galat aplikasi Inventaris di log 5 menit terakhir (tanpa isi variabel lingkungan) */
function checkAppErrors() {
  const log = sh("journalctl", ["-u", "inventaris", "--since", "-5min", "--no-pager", "-o", "cat"]);
  const errs = log.split("\n").filter((l) => /⨯|Error:|Unhandled|FATAL/i.test(l) && !/\.env\.local|exited with code 143/.test(l));
  if (errs.length) add("app:inventaris", `${errs.length} galat di log Inventaris (5 menit terakhir), contoh:\n${errs.slice(0, 3).map((l) => "  " + l.slice(0, 200)).join("\n")}`);
}

async function checkOutbox() {
  try {
    const r = await db.execute(sql`select count(*)::int n from email_outbox where sent_at is null and created_at < now() - interval '1 hour'`);
    const n = (r as unknown as { n: number }[])[0]?.n ?? 0;
    if (n > 0) add("email:outbox", `${n} email Inventaris tertahan lebih dari 1 jam (periksa SMTP/App Password)`);
  } catch (e) {
    add("db:inventaris", `Database Inventaris tidak bisa diakses: ${(e as Error).message}`);
  }
}

function certDaysLeft(host: string) {
  return new Promise<number>((resolve) => {
    const s = connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(c?.valid_to ? Math.floor((Date.parse(c.valid_to) - Date.now()) / 86400_000) : -1);
    });
    s.on("error", () => resolve(-1));
    s.on("timeout", () => { s.destroy(); resolve(-1); });
  });
}

async function checkCerts() {
  const hosts = [...new Set(SITES.map((u) => new URL(u).hostname))];
  await Promise.all(
    hosts.map(async (h) => {
      const d = await certDaysLeft(h);
      if (d >= 0 && d < 14) add(`tls:${h}`, `Sertifikat TLS ${h} habis dalam ${d} hari (perpanjangan otomatis certbot gagal?)`);
    }),
  );
}

type State = { open: Record<string, { since: string; msg: string; alerted: string }> };
function load(): State {
  try {
    return JSON.parse(readFileSync(STATE, "utf8")) as State;
  } catch {
    return { open: {} };
  }
}

await Promise.all([checkSites(), checkCerts(), checkOutbox()]);
checkServices();
checkBackups();
checkDisk();
checkAppErrors();

const now = new Date();
const prev = load();
const next: State = { open: {} };
const fresh: string[] = [];
const ongoing: string[] = [];
for (const [k, msg] of Object.entries(problems)) {
  const old = prev.open[k];
  if (!old) {
    fresh.push(msg);
    next.open[k] = { since: now.toISOString(), msg, alerted: now.toISOString() };
  } else if (now.getTime() - Date.parse(old.alerted) > REMIND_MS) {
    ongoing.push(`${msg} (sejak ${old.since})`);
    next.open[k] = { ...old, msg, alerted: now.toISOString() };
  } else next.open[k] = { ...old, msg };
}
const solved = Object.entries(prev.open).filter(([k]) => !problems[k]).map(([, v]) => v.msg.split("\n")[0]);

if (DRY) {
  console.log(Object.keys(problems).length ? Object.values(problems).join("\n") : "Semua normal.");
  process.exit(0);
}

if (fresh.length || ongoing.length || solved.length) {
  const lines = [
    ...(fresh.length ? ["MASALAH BARU:", ...fresh.map((m) => "• " + m), ""] : []),
    ...(ongoing.length ? ["MASIH BERLANGSUNG:", ...ongoing.map((m) => "• " + m), ""] : []),
    ...(solved.length ? ["SUDAH PULIH:", ...solved.map((m) => "• " + m), ""] : []),
    `Waktu pemeriksaan: ${now.toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA · server 43.156.77.229`,
  ];
  const subject = fresh.length || ongoing.length ? `[Pantau] ${fresh.length + ongoing.length} masalah di server` : "[Pantau] Semua layanan pulih";
  const to = process.env.ALERT_EMAIL ?? platformNotifyEmail();
  console.log(subject + "\n" + lines.join("\n"));
  try {
    if (to) await sendMailStrict(to, subject, lines);
  } catch (e) {
    // Email gagal: biarkan status lama agar peringatan dicoba lagi pada pemeriksaan berikutnya
    console.error("Gagal mengirim email peringatan:", (e as Error).message);
    process.exit(1);
  }
}
writeFileSync(STATE, JSON.stringify(next, null, 1));
process.exit(0);
