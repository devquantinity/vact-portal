"use client";

import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { NativeSelect } from "@/components/forms/field";

export function CompanySwitcher({ companies, current }: { companies: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <Building2 className="size-4 text-muted-foreground" />
      <NativeSelect value={current} onChange={(e) => router.push(`/client?company=${e.target.value}`)} className="w-auto max-w-[70vw] font-medium" aria-label="Switch company">
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
