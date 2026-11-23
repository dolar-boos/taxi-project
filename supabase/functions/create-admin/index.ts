import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = "admin@fontaxi.io";
  const password = "FonTaxi@Admin2026";

  // List existing auth users to find admin by email
  const { data: userList } = await adminClient.auth.admin.listUsers();
  const existingAuth = userList?.users?.find((u) => u.email === email);

  let authUserId: string;

  if (existingAuth) {
    // Update password on existing user
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(
      existingAuth.id,
      { password, email_confirm: true }
    );
    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    authUserId = existingAuth.id;
  } else {
    // Create new admin auth user
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      return new Response(
        JSON.stringify({ error: authErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    authUserId = authData.user.id;
  }

  // Upsert profile with user_id linked to auth user
  await adminClient
    .from("profiles")
    .upsert({
      email,
      role: "admin",
      phone: "admin",
      name: "مدير النظام",
      user_id: authUserId,
    }, { onConflict: "email" });

  return new Response(
    JSON.stringify({ success: true, message: "Admin created", uid: authData.user.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
