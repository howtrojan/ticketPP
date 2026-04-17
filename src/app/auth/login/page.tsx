import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl ?? "/";

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
