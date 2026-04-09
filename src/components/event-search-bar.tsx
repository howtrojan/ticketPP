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
      className="flex w-full max-w-xl items-center gap-2 rounded-2xl border bg-card/60 p-2 shadow-sm backdrop-blur"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        router.push(`/eventos${params.toString() ? `?${params.toString()}` : ""}`);
      }}
    >
      <div className="flex flex-1 items-center gap-2 px-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por artista, evento ou cidade"
          className="border-0 bg-transparent px-0 focus-visible:ring-0"
        />
      </div>
      <Button type="submit" className="rounded-xl">
        Buscar
      </Button>
    </form>
  );
}

