import { PublicHeader } from "../../components/layout/public-header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main>{children}</main>
    </>
  );
}
