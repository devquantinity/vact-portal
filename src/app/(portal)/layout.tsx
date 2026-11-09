import { requireRole } from "@/lib/auth/require";
import { getSettings } from "@/lib/settings";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN", "STAFF");
  const settings = await getSettings();
  return (
    <PortalShell user={{ name: user.name, email: user.email, role: user.role }} brandName={settings.brandName}>
      {children}
    </PortalShell>
  );
}
