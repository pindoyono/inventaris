import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

const BASE_URL = process.env.AUTH_URL ?? "https://inventaris.ankdev.id";
let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(process.env.SMTP_PORT ?? 465);
  transporter =
    SMTP_HOST && SMTP_USER && SMTP_PASS
      ? nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
      : null;
  return transporter;
}

/** Alamat pengelola platform yang menerima pemberitahuan pendaftaran */
export const platformNotifyEmail = () => process.env.PLATFORM_NOTIFY_EMAIL ?? process.env.SMTP_USER ?? null;

/**
 * Kirim email teks. Tidak pernah melempar error: kegagalan email tidak boleh membatalkan
 * transaksi yang sudah tersimpan, cukup dicatat di log layanan.
 */
export async function sendMail(to: string | null | undefined, subject: string, lines: string[]) {
  const t = getTransporter();
  if (!t || !to) return false;
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to,
      subject: `[Inventaris] ${subject}`,
      text: [...lines, "", "—", "Inventaris · Pengelolaan BMD sekolah negeri", BASE_URL].join("\n"),
    });
    return true;
  } catch (e) {
    console.error(`email gagal ke ${to}: ${subject}`, e instanceof Error ? e.message : e);
    return false;
  }
}

export const url = (path: string) => BASE_URL + path;
