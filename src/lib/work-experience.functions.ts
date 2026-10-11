import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkExperienceInput = {
  id?: string | undefined;
  company_name: string;
  role_title: string;
  team_structure: string;
  technologies: string;
  software_tools: string;
  additional_details: string;
};

export const saveWorkExperience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WorkExperienceInput) => {
    if (!input?.company_name?.trim()) throw new Error("Enter a company name.");
    for (const value of [input.company_name, input.role_title, input.team_structure, input.technologies, input.software_tools, input.additional_details]) {
      if (typeof value !== "string" || value.length > 10000) throw new Error("Each field must contain no more than 10,000 characters.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const values = {
      company_name: data.company_name.trim(),
      role_title: data.role_title.trim(),
      team_structure: data.team_structure.trim(),
      technologies: data.technologies.trim(),
      software_tools: data.software_tools.trim(),
      additional_details: data.additional_details.trim(),
    };
    const query = data.id
      ? context.supabase.from("work_experience").update(values).eq("id", data.id).eq("user_id", context.userId)
      : context.supabase.from("work_experience").insert({ ...values, user_id: context.userId });
    const { data: saved, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const deleteWorkExperience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Missing work experience entry.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("work_experience").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });