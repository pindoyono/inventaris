// Pengingat harian (timer 07.00 WITA): peminjaman jatuh tempo/terlambat & stok di bawah minimum.
// Jalankan: bun --conditions=react-server scripts/pengingat-harian.ts
import { runDailyReminders } from "@/lib/server/reminders";
import { processOutbox } from "@/lib/server/inbox";

const n = await runDailyReminders();
const sent = await processOutbox(200);
console.log(`Notifikasi dibuat: ${n}, email terkirim: ${sent}`);
process.exit(0);
