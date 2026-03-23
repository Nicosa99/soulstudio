import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover" as any,
});

// We use the service role key to bypass RLS for administrative updates
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const session = event.data.object as any;

  switch (event.type) {
    case "checkout.session.completed":
      // First time subscription
      const subscriptionId = session.subscription as string;
      const customerId = session.customer as string;
      const userId = session.metadata?.supabase_user_id || session.subscription_data?.metadata?.supabase_user_id;

      if (userId) {
        await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            subscription_id: subscriptionId,
            status: "active",
            price_id: session.line_items?.[0]?.price?.id,
          });
      }
      break;

    case "customer.subscription.deleted":
      // Subscription cancelled or expired
      const deletedSub = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("subscription_id", deletedSub.id);
      break;

    case "customer.subscription.updated":
      // Subscription changed or renewed
      const updatedSub = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("subscriptions")
        .update({ 
          status: updatedSub.status === 'active' ? 'active' : 'canceled',
          current_period_end: new Date(updatedSub.current_period_end * 1000).toISOString()
        })
        .eq("subscription_id", updatedSub.id);
      break;
  }

  return NextResponse.json({ received: true });
}