import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { countries as codes } from "country-flag-icons";
import * as Flags from "country-flag-icons/react/3x2";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// Codes in the flag set that are not countries/territories people live in.
const SKIP = new Set(["AC", "TA", "IC", "EU"]);

type FlagComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & { title?: string }>;

export function Flag({ code, className = "h-3.5 w-5" }: { code: string; className?: string }) {
  const F = (Flags as unknown as Record<string, FlagComponent>)[code];
  return F ? <F title={code} className={`${className} shrink-0 rounded-[2px]`} /> : null;
}

/** All countries, sorted by English name, with ISO code. */
export function useCountries() {
  return useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return codes
      .filter((c) => !SKIP.has(c))
      .map((code) => ({ code, name: names.of(code) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
}

/** Searchable country dropdown with flags. `value` is the country name. */
export function CountrySelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const list = useCountries();
  const selected = list.find((c) => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-[#1f1b27] py-2.5 px-3.5 text-left text-sm text-foreground transition focus:border-primary focus:outline-none"
        >
          {selected && <Flag code={selected.code} />}
          <span className={`flex-1 truncate ${selected ? "" : "text-muted-foreground/50"}`}>{selected?.name ?? "Select country"}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList className="max-h-64">
            <CommandEmpty>No country found.</CommandEmpty>
            {list.map((c) => (
              <CommandItem
                key={c.code}
                value={`${c.name} ${c.code}`}
                onSelect={() => {
                  onChange(c.name);
                  setOpen(false);
                }}
                className="gap-2.5"
              >
                <Flag code={c.code} />
                <span className="flex-1 truncate">{c.name}</span>
                {c.name === value && <Check className="h-4 w-4 text-primary" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
