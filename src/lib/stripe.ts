import Stripe from "stripe";
import { env } from "@/lib/env";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export function getStripe() {
  if (globalForStripe.stripe) return globalForStripe.stripe;
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurado");
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  if (process.env.NODE_ENV !== "production") globalForStripe.stripe = stripe;
  return stripe;
}
