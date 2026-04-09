import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu } from "@/components/user-menu";

export async function SiteHeader() {
  const session = await getSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            TicketPP
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
            <Link href="/eventos" className="hover:text-foreground">
              Eventos
            </Link>
            {user?.role === "ADMIN" ? (
              <Link href="/admin" className="hover:text-foreground">
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
            <Button asChild variant="secondary">
              <Link href="/auth/login">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
