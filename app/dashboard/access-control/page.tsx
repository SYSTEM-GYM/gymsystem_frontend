import { redirect } from "next/navigation";
import { KeyIcon } from "@heroicons/react/24/outline";
import { requireRole, ADMIN_ROLES } from "@/lib/auth-utils";
import { getAccessAnalytics, getHardwareSettings } from "./actions";
import { AccessControlClient } from "./AccessControlClient";

export const revalidate = 0;

export default async function AccessControlPage() {
  const auth = await requireRole([...ADMIN_ROLES, "receptionist"]);
  if (!auth.ok) redirect("/dashboard");

  const [settings, analytics] = await Promise.all([
    getHardwareSettings(),
    getAccessAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <KeyIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
            Catraca & IoT
          </p>
          <h1 className="text-xl font-black text-white leading-tight">
            Controle de Acesso
          </h1>
        </div>
      </div>

      <AccessControlClient settings={settings} analytics={analytics} />
    </div>
  );
}
