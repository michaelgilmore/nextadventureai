import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteWorkExperience, saveWorkExperience, type WorkExperienceInput } from "@/lib/work-experience.functions";

const emptyEntry: WorkExperienceInput = { company_name: "", role_title: "", team_structure: "", technologies: "", software_tools: "", additional_details: "" };
const detailFields = [
  { key: "team_structure", label: "Team structure", placeholder: "Team size, roles, reporting relationships, and collaboration…" },
  { key: "technologies", label: "Technologies", placeholder: "Languages, frameworks, platforms, databases…" },
  { key: "software_tools", label: "Software tools", placeholder: "Development tools, project management, design, monitoring…" },
  { key: "additional_details", label: "Additional details", placeholder: "Projects, responsibilities, achievements, dates, and anything else…" },
] as const;

export function WorkExperienceSection({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<WorkExperienceInput | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const save = useServerFn(saveWorkExperience);
  const remove = useServerFn(deleteWorkExperience);
  const queryClient = useQueryClient();
  const queryKey = ["work-experience", userId];
  const entries = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("work_experience").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const saveMutation = useMutation({
    mutationFn: async (input: WorkExperienceInput) => save({ data: input }),
    onSuccess: () => { setDraft(null); queryClient.invalidateQueries({ queryKey }); toast.success("Work experience saved."); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => { setDeleting(null); queryClient.invalidateQueries({ queryKey }); toast.success("Work experience deleted."); },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="mt-8 border-y border-border py-6" aria-labelledby="work-experience-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="work-experience-heading" className="text-lg font-semibold">Work experience</h2>
        {!draft && <Button variant="outline" onClick={() => setDraft({ ...emptyEntry })}><Plus className="size-4" /> Add company</Button>}
      </div>

      {draft && (
        <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(draft); }}>
          <h3 className="font-medium">{draft.id ? "Edit work experience" : "Add work experience"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="experience-company">Company name</Label>
              <Input id="experience-company" required maxLength={10000} value={draft.company_name} onChange={(event) => setDraft({ ...draft, company_name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience-role">Role / job title</Label>
              <Input id="experience-role" maxLength={10000} value={draft.role_title} onChange={(event) => setDraft({ ...draft, role_title: event.target.value })} />
            </div>
            {detailFields.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`experience-${key}`}>{label}</Label>
                <Textarea id={`experience-${key}`} rows={4} maxLength={10000} placeholder={placeholder} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending || !draft.company_name.trim()}>{saveMutation.isPending ? "Saving…" : "Save work experience"}</Button>
            <Button type="button" variant="ghost" disabled={saveMutation.isPending} onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {entries.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading work experience…</p>}
      {entries.isError && <div className="mt-4 flex items-center gap-3"><p className="text-sm text-destructive">Could not load work experience.</p><Button variant="outline" size="sm" onClick={() => entries.refetch()}>Retry</Button></div>}
      {entries.data?.length === 0 && !draft && <p className="mt-4 text-sm text-muted-foreground">No work experience added yet.</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {entries.data?.map((entry) => (
          <article key={entry.id} className="min-w-0 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="flex items-start gap-2 font-semibold"><Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="break-words">{entry.company_name}</span></h3>{entry.role_title && <p className="mt-1 break-words text-sm text-muted-foreground">{entry.role_title}</p>}</div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" title={`Edit ${entry.company_name}`} aria-label={`Edit ${entry.company_name}`} disabled={Boolean(draft)} onClick={() => setDraft({ ...entry })}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" title={`Delete ${entry.company_name}`} aria-label={`Delete ${entry.company_name}`} disabled={Boolean(draft) || deleteMutation.isPending} onClick={() => setDeleting({ id: entry.id, name: entry.company_name })}><Trash2 className="size-4" /></Button>
              </div>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              {detailFields.map(({ key, label }) => entry[key] && <div key={key}><dt className="font-medium">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{entry[key]}</dd></div>)}
            </dl>
          </article>
        ))}
      </div>
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete work experience?</AlertDialogTitle><AlertDialogDescription>This will remove your work experience entry for {deleting?.name}. Your company reviews and saved jobs will not be changed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={deleteMutation.isPending} onClick={(event) => { event.preventDefault(); if (deleting) deleteMutation.mutate(deleting.id); }}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}