import { PublicHeader } from "../../components/layout/public-header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PublicHeader />
      <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
    </div>
  );
}
