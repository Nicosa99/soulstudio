import { createClient } from "@/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import Stripe from "stripe";

export async function GET(request: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // @ts-expect-error - Clover is a specific preview version
      apiVersion: "2026-02-25.clover",
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Dynamically detect the correct origin (handles proxies/localhost correctly)
    const baseUrl = request.nextUrl.origin;

    if (!user) {
      return NextResponse.redirect(new URL("/login", baseUrl));
    }

    // BRIEF DELAY: Allow the Stripe Webhook to complete its background database update
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 1. Try checking our database first
    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("status, stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (currentSub?.status === 'active') {
       console.log("Subscription already active in DB via Webhook");
       return NextResponse.redirect(new URL("/studio", baseUrl));
    }

    // 2. Fallback: If webhook hasn't fired or failed, ask Stripe directly
    if (currentSub?.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: currentSub.stripe_customer_id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const stripeSub = subscriptions.data[0];
        console.log("Activating subscription via direct Stripe check (Fallback)");
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            subscription_id: stripeSub.id,
          })
          .eq("user_id", user.id);
      }
    }

    return NextResponse.redirect(new URL("/studio", baseUrl));
  } catch (err: unknown) {
    console.error("Subscription sync error:", err);
    return NextResponse.redirect(new URL("/studio", request.nextUrl.origin));
  }
}
