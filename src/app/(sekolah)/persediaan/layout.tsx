import { SubNav } from "./sub-nav";

export default function PersediaanLayout({ children }: LayoutProps<"/persediaan">) {
  return (
    <div className="space-y-6">
      <SubNav />
      {children}
    </div>
  );
}
