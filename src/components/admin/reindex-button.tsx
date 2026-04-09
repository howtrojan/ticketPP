"use client";

import * as React from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReindexButton() {
  const [loading, setLoading] = React.useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      className="rounded-2xl"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/admin/search/reindex", { method: "POST" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast.error("Falha ao reindexar.");
            return;
          }
          toast.success(`Busca atualizada: ${data.indexed ?? 0} eventos`);
        } finally {
          setLoading(false);
        }
      }}
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      Reindexar busca
    </Button>
  );
}

