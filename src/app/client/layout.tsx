import { requireRole } from "@/lib/auth/require";
import { getSettings } from "@/lib/settings";
import { ClientShell } from "@/components/layout/client-shell";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CLIENT");
  const settings = await getSettings();
  return (
    <ClientShell user={{ name: user.name, email: user.email, role: user.role }} brandName={settings.brandName}>
      {children}
    </ClientShell>
  );
}
