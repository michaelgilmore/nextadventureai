import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { goals: string }) => ({ goals: (input?.goals ?? "").slice(0, 5000) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, goals: data.goals.trim() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
