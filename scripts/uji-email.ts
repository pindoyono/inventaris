// Uji koneksi SMTP & kirim email uji: bun scripts/uji-email.ts tujuan@contoh.id
import nodemailer from "nodemailer";

const to = process.argv[2];
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: Number(process.env.SMTP_PORT ?? 465) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
await t.verify();
console.log("Login SMTP berhasil.");
if (to) {
  const info = await t.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to,
    subject: "Uji email Inventaris",
    text: "Email uji dari server Inventaris (inventaris.ankdev.id). Jika Anda menerima ini, pengiriman email sudah berfungsi.",
  });
  console.log("Terkirim:", info.response);
}
