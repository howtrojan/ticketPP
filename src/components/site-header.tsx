"use client";

import Link from "next/link";
import { Ticket } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu } from "@/components/user-menu";

export function SiteHeader() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="group inline-flex items-center gap-2 rounded-xl px-2 py-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-primary/75 text-primary-foreground shadow-sm">
              <Ticket className="h-4 w-4" />
            </span>
            <span className="font-heading text-base font-semibold tracking-tight">TicketPP</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Link href="/eventos" className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              Eventos
            </Link>
            {user?.role === "ADMIN" ? (
              <Link href="/admin" className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                Admin
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
          {user?.id ? (
            <UserMenu name={user.name} email={user.email} role={user.role} />
          ) : (
            <Button asChild variant="default">
              <Link href="/auth/login">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
