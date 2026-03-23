import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover" as any,
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002"));
    }

    // Get stripe customer ID from DB
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (sub?.stripe_customer_id) {
      // Fetch active subscriptions directly from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: sub.stripe_customer_id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const stripeSub = subscriptions.data[0];
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            subscription_id: stripeSub.id,
          })
          .eq("user_id", user.id);
      }
    }

    return NextResponse.redirect(new URL("/studio", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002"));
  } catch (err: any) {
    console.error("Subscription sync error:", err);
    return NextResponse.redirect(new URL("/studio", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002"));
  }
}
