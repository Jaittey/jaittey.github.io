// Small Business v4.2 - company login provisioning
// Import your existing configured Supabase client here.
import { supabase } from "../config/supabase";

export async function createCompanyLogin({
  companyId,
  displayName,
  email,
  password,
  role = "user",
  permissions = [],
}) {
  const { data, error } = await supabase.functions.invoke("create-company-user", {
    body: { companyId, displayName, email, password, role, permissions },
  });

  if (error) throw new Error(error.message || "Unable to create company user.");
  if (!data?.ok) throw new Error(data?.error || "Unable to create company user.");
  return data.user;
}

export function friendlyCompanyUserError(error) {
  const message = String(error?.message || error || "");
  if (/already.*registered|already.*exists|already belongs/i.test(message))
    return "This email already has a company login.";
  if (/password/i.test(message))
    return "Use a password with at least 8 characters.";
  if (/administrator|permission|not authenticated|invalid session/i.test(message))
    return "Only the company Administrator can create or change company logins.";
  if (/rate limit/i.test(message))
    return "Please wait a moment and try again.";
  return message || "Unable to create company login.";
}
