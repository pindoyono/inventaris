import "./cetak.css";
import { pageSchoolUser } from "@/lib/server/guard";

export default async function CetakLayout({ children }: LayoutProps<"/cetak">) {
  await pageSchoolUser();
  return <>{children}</>;
}
