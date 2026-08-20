import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://jaittey.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://jaittey.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const normalizeEmail = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFKC")
  .replace(/[\s\u200B-\u200D\u2060\uFEFF]+/g, "");

const normalizeName = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFKC")
  .replace(/\s+/g, " ");

const response = (
  origin: string | null,
  body: Record<string, unknown>,
  status = 200,
) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders(origin),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
});

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return response(origin, { ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Employee registration service is not configured.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const displayName = String(body?.displayName || "").trim().replace(/\s+/g, " ");
    const normalizedName = normalizeName(displayName);
    const password = String(body?.password || "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return response(origin, { ok: false, error: "Enter a valid email address." });
    }

    if (!normalizedName) {
      return response(origin, {
        ok: false,
        error: "Enter the name provided by your company Administrator.",
      });
    }

    if (password.length < 8) {
      return response(origin, {
        ok: false,
        error: "Password must contain at least 8 characters.",
      });
    }

    // Lightweight per-email throttling. The table is private and is only used
    // by this service-role function.
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { count: recentAttempts, error: countError } = await admin
      .from("company_user_activation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("attempted_at", windowStart);

    if (countError) throw countError;

    if (Number(recentAttempts || 0) >= 8) {
      return response(origin, {
        ok: false,
        error: "Too many registration attempts. Please wait 15 minutes and try again.",
      });
    }

    await admin.from("company_user_activation_attempts").insert({
      email,
      attempted_at: new Date().toISOString(),
      success: false,
    });

    // If a membership already has a user_id, this email was activated before.
    const { data: activatedRows, error: activatedError } = await admin
      .from("business_memberships")
      .select("business_id,email,user_id,display_name,active")
      .eq("email", email)
      .eq("active", true)
      .not("user_id", "is", null);

    if (activatedError) throw activatedError;

    if ((activatedRows || []).length) {
      return response(origin, {
        ok: false,
        error: "This employee account is already activated. Use Email sign in instead.",
      });
    }

    // Find pending company memberships created by an Administrator.
    const { data: pendingRows, error: pendingError } = await admin
      .from("business_memberships")
      .select(`
        business_id,
        email,
        user_id,
        business_name,
        display_name,
        role,
        active,
        notes,
        custom_permissions,
        permissions
      `)
      .eq("email", email)
      .eq("active", true)
      .is("user_id", null);

    if (pendingError) throw pendingError;

    if (!(pendingRows || []).length) {
      return response(origin, {
        ok: false,
        error: "This email has not been added by a company Administrator.",
      });
    }

    const matchingRows = (pendingRows || []).filter(
      (row) => normalizeName(row.display_name) === normalizedName,
    );

    if (!matchingRows.length) {
      return response(origin, {
        ok: false,
        error: "The name does not match the name provided by your company Administrator.",
      });
    }

    // Create the Auth identity only after the invitation/membership is verified.
    // email_confirm=true means no confirmation-email round trip is required.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        display_name: displayName,
        account_type: "company_user",
      },
      app_metadata: {
        account_type: "company_user",
      },
    });

    if (createError) {
      const message = String(createError.message || "");

      if (/already.*registered|already.*exists|user already/i.test(message)) {
        return response(origin, {
          ok: false,
          error: "An Auth account already uses this email. Use Email sign in or ask your Administrator for help.",
        });
      }

      throw createError;
    }

    if (!created.user?.id) {
      throw new Error("Supabase did not return the new employee account.");
    }

    const userId = created.user.id;
    const businessIds = matchingRows.map((row) => row.business_id);

    const { error: memberError } = await admin
      .from("business_memberships")
      .update({
        user_id: userId,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email)
      .eq("active", true)
      .is("user_id", null)
      .in("business_id", businessIds);

    if (memberError) {
      // Avoid leaving a usable Auth account without its business membership.
      await admin.auth.admin.deleteUser(userId);
      throw memberError;
    }

    // Mark the newest attempt successful.
    const { data: latestAttempt } = await admin
      .from("company_user_activation_attempts")
      .select("id")
      .eq("email", email)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestAttempt?.id) {
      await admin
        .from("company_user_activation_attempts")
        .update({ success: true })
        .eq("id", latestAttempt.id);
    }

    return response(origin, {
      ok: true,
      email,
      displayName,
      businessCount: businessIds.length,
      message: "Employee account activated. Use Email sign in.",
    });
  } catch (error) {
    console.error("activate-company-user:", error);

    return response(origin, {
      ok: false,
      error: error?.message || "Unable to activate employee account.",
    });
  }
});
