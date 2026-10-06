import "server-only";
import { LEVEL_LABEL } from "@/lib/validations";
import { platformNotifyEmail, sendMail, url } from "@/lib/server/mail";

type SchoolInfo = {
  npsn: string;
  name: string;
  level: keyof typeof LEVEL_LABEL;
  regencyName?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
};

export async function notifyRegistration(s: SchoolInfo) {
  await Promise.all([
    sendMail(platformNotifyEmail(), `Pendaftaran baru: ${s.name} (${s.npsn})`, [
      "Ada sekolah baru yang menunggu persetujuan.",
      "",
      `Sekolah   : ${s.name}`,
      `NPSN      : ${s.npsn}`,
      `Jenjang   : ${LEVEL_LABEL[s.level]}${s.regencyName ? `, ${s.regencyName}` : ""}`,
      `PJ        : ${s.contactName} · ${s.contactPhone}${s.contactEmail ? ` · ${s.contactEmail}` : ""}`,
      "",
      `Periksa NPSN: https://referensi.data.kemendikdasmen.go.id/pendidikan/npsn/${s.npsn}`,
      `Setujui/tolak: ${url("/platform")}`,
    ]),
    sendMail(s.contactEmail, "Pendaftaran sekolah diterima", [
      `Yth. ${s.contactName},`,
      "",
      `Pendaftaran ${s.name} (NPSN ${s.npsn}) sudah kami terima dan sedang menunggu pemeriksaan pengelola platform.`,
      "Kami akan mengirim email lagi setelah pendaftaran disetujui.",
    ]),
  ]);
}

export async function notifyStatusChange(
  s: { npsn: string; name: string; contactName: string; contactEmail: string | null },
  status: "ACTIVE" | "REJECTED" | "SUSPENDED",
  note: string | null,
  firstApproval: boolean,
) {
  const reason = note ? ["", `Keterangan: ${note}`] : [];
  const body =
    status === "ACTIVE"
      ? {
          subject: firstApproval ? "Pendaftaran sekolah disetujui" : "Akun sekolah diaktifkan kembali",
          lines: [
            `${s.name} (NPSN ${s.npsn}) sudah ${firstApproval ? "disetujui" : "diaktifkan kembali"}.`,
            "",
            `Admin sekolah dapat masuk di ${url("/login")} dengan NPSN, username, dan password yang dibuat saat mendaftar.`,
            ...(firstApproval ? ["Setelah masuk, lengkapi menu Penyiapan sebelum mulai mencatat barang."] : []),
            ...reason,
          ],
        }
      : status === "REJECTED"
        ? { subject: "Pendaftaran sekolah ditolak", lines: [`Pendaftaran ${s.name} (NPSN ${s.npsn}) tidak dapat kami setujui.`, ...reason] }
        : { subject: "Akun sekolah dinonaktifkan", lines: [`Akun ${s.name} (NPSN ${s.npsn}) dinonaktifkan sementara.`, ...reason] };
  return sendMail(s.contactEmail, body.subject, [`Yth. ${s.contactName},`, "", ...body.lines]);
}
