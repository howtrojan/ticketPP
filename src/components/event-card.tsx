import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      <Card className="overflow-hidden transition-colors hover:border-foreground/20">
        <CardHeader className="p-0">
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
            {event.coverImageUrl ? (
              <Image
                src={event.coverImageUrl}
                alt={event.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                sizes="(max-width: 768px) 100vw, 33vw"
                priority={false}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/15 to-transparent" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
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
        </CardContent>
      </Card>
    </Link>
  );
}

