window.SUPABASE_CONFIG = {
  url: "https://muebjorbqxuppzaixykg.supabase.co",
  anonKey: "sb_publishable_mybDlaBdUg9SN8nems0_Cg_QiVdgwY_"
};

window.getSupabaseClient = (() => {
  let client = null;

  return function getSupabaseClient() {
    if (client) return client;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase library failed to load");
    }

    const { url, anonKey } = window.SUPABASE_CONFIG || {};
    if (!url || !anonKey) {
      throw new Error("Supabase config is missing");
    }

    client = window.supabase.createClient(url, anonKey);
    return client;
  };
})();
