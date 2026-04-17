"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EventSearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState(defaultValue ?? "");

  return (
    <form
      className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-border/70 bg-card/90 p-2.5 shadow-[0_18px_44px_-32px_rgba(26,20,48,0.65)] backdrop-blur"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        router.push(`/eventos${params.toString() ? `?${params.toString()}` : ""}`);
      }}
    >
      <div className="flex flex-1 items-center gap-2.5 px-2.5">
        <Search className="h-4 w-4 text-primary/85" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por artista, evento ou cidade"
          className="h-10 border-0  px-0 text-sm focus-visible:ring-0"
        />
      </div>
      <Button type="submit" className="rounded-xl px-5">
        Buscar
      </Button>
    </form>
  );
}
