// Kirim antrean email yang tertunda/gagal (dipanggil timer tiap 10 menit).
// Jalankan: bun --conditions=react-server scripts/kirim-email.ts
import { processOutbox } from "@/lib/server/inbox";

const sent = await processOutbox(100);
if (sent) console.log(`Email terkirim: ${sent}`);
process.exit(0);
