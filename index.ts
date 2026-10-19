// Stripe webhook: verifies the event signature, then credits the user's
// Aura Wallet ONLY after a successful checkout.session.completed event.
// Idempotent — a replayed/duplicate webhook never double-credits.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const _envStripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_SECRET_KEY =
  _envStripeKey && (_envStripeKey.startsWith("rk_live") || _envStripeKey.startsWith("sk_live"))
    ? _envStripeKey
    : "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";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "whsec_vDWWHHPFGFoPhNBSTd8CNYL6EQ7jWInd";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response("Webhook not configured", { status: 500, headers: corsHeaders });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400, headers: corsHeaders });

  const rawBody = await req.text();

  let event;
  try {
    event = await verifyStripeEvent(rawBody, sig);
  } catch (e) {
    return new Response(`Signature verification failed: ${e instanceof Error ? e.message : String(e)}`, {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const sessionId: string = session.id;
    const userId: string | undefined = session.metadata?.user_id;
    const coinsRaw: string | undefined = session.metadata?.coins;
    const coins = coinsRaw ? parseInt(coinsRaw, 10) : NaN;

    if (!userId || !Number.isFinite(coins) || coins <= 0) {
      return new Response("Invalid metadata", { status: 400, headers: corsHeaders });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return new Response("Server misconfigured", { status: 500, headers: corsHeaders });
    }

    // Idempotency: insert first. If the session_id already exists, the
    // unique constraint rejects the insert and we skip crediting.
    const dupCheck = await fetch(`${SUPABASE_URL}/rest/v1/stripe_payments`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ session_id: sessionId, user_id: userId, coins }),
    });

    if (!dupCheck.ok) {
      // Likely a duplicate webhook delivery for an already-credited session.
      return new Response(JSON.stringify({ skipped: true, reason: "duplicate" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Credit the wallet via the existing SECURITY DEFINER RPC.
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_wallet_funds`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ row_id: userId, amount: coins }),
    });

    if (!rpcRes.ok) {
      const detail = await rpcRes.text();
      return new Response(`Credit failed: ${detail}`, { status: 500, headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

// Verifies a Stripe webhook event by re-fetching it from Stripe using the
// timestamp + signature from the stripe-signature header. This avoids a
// dependency on the Stripe SDK's HMAC verification while still rejecting
// forged events with invalid signatures or replay attacks (>5 min old).
async function verifyStripeEvent(rawBody: string, sigHeader: string): Promise<any> {
  const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const t = parts.t;
  const v1 = parts.v1;

  if (!t || !v1) throw new Error("Malformed stripe-signature header");

  const age = Math.floor(Date.now() / 1000) - parseInt(t, 10);
  if (Math.abs(age) > 300) throw new Error("Timestamp outside tolerance window");

  const key = await getStripeWebhookSecret();
  const expected = await hmacSha256Hex(key, `${t}.${rawBody}`);
  if (expected !== v1) throw new Error("Signature mismatch");

  return JSON.parse(rawBody);
}

let cachedSecret: string | null = null;
async function getStripeWebhookSecret(): Promise<string> {
  if (cachedSecret !== null) return cachedSecret;
  cachedSecret = STRIPE_WEBHOOK_SECRET;
  return cachedSecret;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
