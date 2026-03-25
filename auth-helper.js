function isBypassAdmin() {
  return false;
}

async function requireLogin(sb) {
  try {
    if (isBypassAdmin()) {
      console.log("Bypass admin mode active");
      return true;
    }

    const { data, error } = await sb.auth.getSession();
    if (error || !data.session) {
      window.location.href = "index.html";
      return false;
    }

    return true;
  } catch (err) {
    console.error("requireLogin error:", err);
    window.location.href = "index.html";
    return false;
  }
}

async function getCurrentRole(sb) {
  try {
    if (isBypassAdmin()) return "admin";

    const {
      data: { user },
      error: userError
    } = await sb.auth.getUser();

    if (userError || !user) return null;

    const { data, error } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (error || !data) return null;

    return data.role;
  } catch (err) {
    console.error("getCurrentRole error:", err);
    return null;
  }
}