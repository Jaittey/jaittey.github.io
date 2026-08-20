import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) throw new Error("Not authenticated.");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Invalid session.");

    const body = await req.json();
    const companyId = String(body.companyId || "");
    const displayName = String(body.displayName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "user").toLowerCase();
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    if (!companyId || !displayName || !email || password.length < 8)
      throw new Error("Company, name, email and a password of at least 8 characters are required.");
    if (!["manager", "user"].includes(role))
      throw new Error("Company login role must be Manager or User.");

    // SECURITY: verify caller is an active administrator of THIS company.
    const { data: caller, error: callerError } = await adminClient
      .from("company_users")
      .select("id, role, status")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerError) throw callerError;
    if (!caller || caller.status !== "active" || caller.role !== "administrator")
      throw new Error("Only an active company Administrator can create company logins.");

    // Prevent duplicate company membership by email.
    const { data: duplicate } = await adminClient
      .from("company_users")
      .select("id, email")
      .eq("company_id", companyId)
      .ilike("email", email)
      .maybeSingle();
    if (duplicate) throw new Error("This email already belongs to a user in this company.");

    // Create Auth user server-side. No confirmation email is sent, avoiding public signup email limits.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        account_type: "company_user",
        company_id: companyId,
        role,
      },
      app_metadata: {
        account_type: "company_user",
        company_id: companyId,
      },
    });
    if (createError) throw createError;
    if (!created.user) throw new Error("Supabase did not return the new user.");

    // Link Auth identity to tenant/company.
    const { error: memberError } = await adminClient.from("company_users").insert({
      company_id: companyId,
      user_id: created.user.id,
      email,
      display_name: displayName,
      role,
      status: "active",
      permissions,
      created_by: user.id,
    });

    if (memberError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw memberError;
    }

    return new Response(JSON.stringify({
      ok: true,
      user: {
        id: created.user.id,
        email,
        displayName,
        role,
        permissions,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Unable to create company user." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
