import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get or create stripe customer
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      
      // Store it
      await supabase.from("subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        status: 'free'
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id, // Redundant fallback for webhook
      metadata: { supabase_user_id: user.id }, // Metadata for the checkout session itself
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_PRO,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${request.headers.get("origin")}/api/subscription/sync`,
      cancel_url: `${request.headers.get("origin")}/studio`,
      subscription_data: {
        metadata: { supabase_user_id: user.id }, // Metadata for the resulting subscription object
      },
    });

    return NextResponse.json({ url: session.url });
    } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Stripe Checkout Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
    }
    }