import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/forms/field";

/** GET form that writes its fields into the URL's search params. */
export function SearchFilterBar({
  action,
  query,
  placeholder = "Search…",
  selects = [],
  hidden = {},
}: {
  action: string;
  query?: string;
  placeholder?: string;
  selects?: { name: string; value?: string; options: { value: string; label: string }[]; allLabel: string }[];
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-72">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input name="q" defaultValue={query ?? ""} placeholder={placeholder} className="pl-8" />
      </div>
      {selects.map((s) => (
        <NativeSelect key={s.name} name={s.name} defaultValue={s.value ?? ""} className="w-auto min-w-[150px]">
          <option value="">{s.allLabel}</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ))}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
