import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    // @ts-expect-error - Clover is a specific preview version
    apiVersion: "2026-02-25.clover",
  });

  // We use the service role key to bypass RLS for administrative updates
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      // First time subscription or one-time payment
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = checkoutSession.subscription as string;
      const customerId = checkoutSession.customer as string;

      // Try to find the user ID in multiple possible locations
      const userId = checkoutSession.metadata?.supabase_user_id || 
                     checkoutSession.client_reference_id ||
                     (checkoutSession as any).subscription_data?.metadata?.supabase_user_id;


      if (userId) {
        console.log(`Updating subscription for user ${userId} to active`);
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            subscription_id: subscriptionId,
            status: "active",
            // We don't necessarily have line_items here unless expanded, 
            // but we can at least set the status to active
          }, { onConflict: 'user_id' });
        
        if (error) {
          console.error(`Error updating subscription for user ${userId}:`, error);
        }
      } else {
        console.error("No userId found in checkout.session.completed event metadata");
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