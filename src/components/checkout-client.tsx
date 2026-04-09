"use client";

import * as React from "react";
import { useSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function CheckoutClient() {
  const { status } = useSession();
  const [ticketIds, setTicketIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const raw = window.localStorage.getItem("ticketpp:selectedTickets");
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const ids = Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    setTicketIds(ids);
  }, []);

  async function pay() {
    if (!ticketIds.length) {
      toast.error("Nenhum ingresso selecionado.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/stripe/checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "HOLD_REQUIRED") toast.error("Sua reserva não está ativa. Volte e selecione novamente.");
        else if (data?.error === "TICKET_UNAVAILABLE") toast.error("Um dos ingressos ficou indisponível.");
        else if (data?.error === "RATE_LIMITED") toast.error("Muitas tentativas. Aguarde um pouco.");
        else toast.error("Falha ao iniciar o pagamento.");
        return;
      }

      const url = data?.url as string | undefined;
      if (!url) {
        toast.error("Stripe não retornou URL de checkout.");
        return;
      }

      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="text-base font-semibold tracking-tight">Pagamento</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" />
          Checkout hospedado no Stripe, confirmação via webhook
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border bg-card/40 p-4">
          <div className="text-sm font-semibold">Ingressos selecionados</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {ticketIds.length ? `${ticketIds.length} ingresso(s) em reserva` : "Nada selecionado ainda"}
          </div>
        </div>
        <Separator />
        {status !== "authenticated" ? (
          <Button
            className="w-full rounded-2xl"
            size="lg"
            onClick={() => signIn(undefined, { callbackUrl: "/checkout" })}
          >
            Entrar para pagar
          </Button>
        ) : (
          <Button className="w-full rounded-2xl" size="lg" onClick={pay} disabled={loading || !ticketIds.length}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Continuar no Stripe
          </Button>
        )}
        <div className="text-xs text-muted-foreground">
          Se sua reserva expirar, o ingresso volta automaticamente para venda.
        </div>
      </CardContent>
    </Card>
  );
}

