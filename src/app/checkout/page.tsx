import { CheckoutClient } from "@/components/checkout-client";

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conclua o pagamento antes da sua reserva expirar.
        </p>
      </div>
      <CheckoutClient />
    </div>
  );
}

