import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export type EventCardItem = {
  slug: string;
  title: string;
  startAt: Date;
  coverImageUrl: string | null;
  venue: { name: string; city: string; state: string | null };
};

export function EventCard({ event }: { event: EventCardItem }) {
  return (
    <Link href={`/eventos/${event.slug}`} className="group block">
      <Card className="overflow-hidden border-border/70 bg-card/90 transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:shadow-[0_24px_48px_-28px_rgba(57,39,129,0.6)]">
        <CardHeader className="p-0">
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
            {event.coverImageUrl ? (
              <Image
                src={event.coverImageUrl}
                alt={event.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 33vw"
                priority={false}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 via-accent/20 to-background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
            <div className="absolute left-3 top-3">
              <Badge className="bg-background/80 text-foreground backdrop-blur">Destaque</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <div className="text-base font-semibold leading-tight tracking-tight">{event.title}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{formatDateTime(event.startAt)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {event.venue.city}
                {event.venue.state ? ` · ${event.venue.state}` : ""}
              </span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Ver detalhes <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
