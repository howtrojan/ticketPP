"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/format";

type SeatState = "AVAILABLE" | "HELD" | "SOLD" | "UNAVAILABLE";

type EventPayload = {
  id: string;
  slug: string;
  title: string;
  description: string;
  startAt: string;
  coverImageUrl: string | null;
  venue: { name: string; city: string; state: string | null };
  sectors: {
    id: string;
    name: string;
    kind: "GENERAL_ADMISSION" | "SEATED";
    capacity: number;
    available: number;
    held: number;
    sold: number;
    minPrice: number | null;
    lots: { id: string; name: string; priceCents: number; currency: string }[];
    seats:
      | {
          id: string;
          label: string;
          row: string | null;
          number: number | null;
          state: SeatState;
          ticketId: string | null;
          priceCents: number | null;
        }[]
      | null;
  }[];
};

type SelectedTicket = {
  ticketId: string;
  sectorName: string;
  seatLabel: string | null;
  priceCents: number;
  currency: string;
  expiresAtMs: number;
};

export function TicketPicker({ event }: { event: EventPayload }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<SelectedTicket | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const remainingSeconds = selected ? Math.max(0, Math.floor((selected.expiresAtMs - now) / 1000)) : 0;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  React.useEffect(() => {
    if (!selected) return;
    if (remainingSeconds > 0) return;
    setSelected(null);
    toast.error("Sua reserva expirou. Selecione novamente.");
  }, [remainingSeconds, selected]);

  async function reserveSeat(ticketId: string, sectorName: string, seatLabel: string | null, priceCents: number, currency: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/booking/hold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Não foi possível reservar este ingresso.");
        return;
      }

      const ttlSeconds = Number(data.ttlSeconds ?? 420);
      const expiresAtMs = Date.now() + ttlSeconds * 1000;

      const next = { ticketId, sectorName, seatLabel, priceCents, currency, expiresAtMs };
      setSelected(next);
      window.localStorage.setItem("ticketpp:selectedTickets", JSON.stringify([ticketId]));
      toast.success("Reserva criada. Você tem 7 minutos para concluir.");
    } finally {
      setLoading(false);
    }
  }

  async function reserveGA(sectorId: string, sectorName: string, lotId: string, priceCents: number, currency: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/booking/hold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id, sectorId, lotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Setor indisponível no momento.");
        return;
      }

      const ttlSeconds = Number(data.ttlSeconds ?? 420);
      const expiresAtMs = Date.now() + ttlSeconds * 1000;
      const ticketId = data.ticket?.id as string;

      const next = { ticketId, sectorName, seatLabel: null, priceCents, currency, expiresAtMs };
      setSelected(next);
      window.localStorage.setItem("ticketpp:selectedTickets", JSON.stringify([ticketId]));
      toast.success("Reserva criada. Você tem 7 minutos para concluir.");
    } finally {
      setLoading(false);
    }
  }

  async function goToCheckout() {
    if (!selected) return;
    router.push(`/checkout?event=${event.slug}`);
  }

  const defaultSectorId = event.sectors[0]?.id ?? "none";

  return (
    <Card className="sticky top-20">
      <CardHeader className="space-y-2">
        <div className="text-base font-semibold tracking-tight">Selecione seus ingressos</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Reserva com TTL de 7 minutos (anti-oversell)
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selected ? (
          <div className="rounded-2xl border bg-card/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold">{selected.sectorName}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.seatLabel ? `Assento ${selected.seatLabel}` : "Ingresso (pista/geral)"}
                </div>
              </div>
              <div className="text-sm font-semibold">{formatMoney(selected.priceCents, selected.currency)}</div>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={remainingSeconds <= 30 ? "text-destructive" : "text-muted-foreground"}>
                  Expira em {minutes}:{seconds.toString().padStart(2, "0")}
                </span>
              </div>
              <Button onClick={goToCheckout} className="rounded-2xl" disabled={remainingSeconds <= 0}>
                Ir para checkout
              </Button>
            </div>
          </div>
        ) : null}

        <Tabs defaultValue={defaultSectorId} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            {event.sectors.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="whitespace-nowrap">
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {event.sectors.map((sector) => (
            <TabsContent key={sector.id} value={sector.id} className="mt-4 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{sector.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {sector.available} disponíveis • {sector.held} em reserva
                  </div>
                </div>
                {sector.minPrice != null ? (
                  <div className="text-sm font-semibold">{formatMoney(sector.minPrice, "BRL")}</div>
                ) : null}
              </div>

              {sector.kind === "GENERAL_ADMISSION" ? (
                <div className="space-y-2">
                  {sector.lots.map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                      <div>
                        <div className="text-sm font-semibold">{lot.name}</div>
                        <div className="text-xs text-muted-foreground">Setor {sector.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{formatMoney(lot.priceCents, lot.currency)}</div>
                        <Button
                          className="rounded-2xl"
                          disabled={loading || sector.available <= 0}
                          onClick={() => reserveGA(sector.id, sector.name, lot.id, lot.priceCents, lot.currency)}
                        >
                          Reservar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : sector.seats ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                      Disponível
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                      Reservado
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-zinc-500/70" />
                      Vendido
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      Indisponível
                    </div>
                  </div>

                  <div className="grid grid-cols-8 gap-2 rounded-3xl border bg-card/40 p-4">
                    {sector.seats.slice(0, 64).map((seat) => {
                      const disabled = seat.state !== "AVAILABLE" || !seat.ticketId || loading;
                      const variant: "secondary" | "outline" | "ghost" =
                        seat.state === "AVAILABLE"
                          ? "secondary"
                          : seat.state === "HELD"
                            ? "outline"
                            : "ghost";
                      return (
                        <Button
                          key={seat.id}
                          type="button"
                          size="sm"
                          variant={variant}
                          className="h-9 rounded-xl px-0 text-xs"
                          disabled={disabled}
                          onClick={() =>
                            reserveSeat(
                              seat.ticketId!,
                              sector.name,
                              seat.label,
                              seat.priceCents ?? sector.minPrice ?? 0,
                              "BRL",
                            )
                          }
                        >
                          {seat.label}
                        </Button>
                      );
                    })}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Para MVP, exibimos um recorte do mapa de assentos. O modelo suporta mapa completo.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum assento configurado.</div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

