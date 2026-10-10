import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/companies")({
  head: () => ({
    meta: [
      { title: "Company reviews — NextAdventureAI" },
      {
        name: "description",
        content: "Review companies, note their size and offices, and rate them to steer your job search.",
      },
      { property: "og:title", content: "Company reviews — NextAdventureAI" },
      {
        property: "og:description",
        content: "Rate companies as favorites or ones to avoid so job postings are filtered and scored accordingly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompaniesPage,
});

const RATINGS = [
  { value: 0, label: "0 — Do not consider" },
  { value: 1, label: "1 — Neutral" },
  { value: 2, label: "2 — Favorite" },
] as const;

type Form = {
  id: string | null;
  name: string;
  description: string;
  office_location: string;
  company_size: string;
  rating: number;
};

const EMPTY: Form = {
  id: null,
  name: "",
  description: "",
  office_location: "",
  company_size: "",
  rating: 1,
};

function CompaniesPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);

  const companies = useQuery({
    queryKey: ["companies", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("rating", { ascending: false })
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first.");
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        office_location: form.office_location.trim(),
        company_size: form.company_size.trim(),
        rating: form.rating,
      };
      if (!payload.name) throw new Error("Company name is required.");
      const { error } = form.id
        ? await supabase.from("companies").update(payload).eq("id", form.id)
        : await supabase.from("companies").insert({ ...payload, user_id: user.id });
      if (error) {
        throw new Error(
          error.code === "23505" ? "That company is already in your list." : error.message,
        );
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Company updated." : "Company added.");
      setForm(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <AppShell>Loading…</AppShell>;
  if (!user) return <AppShell>Sign in to review companies.</AppShell>;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <AppShell>
      <section className="panel p-6">
        <h1 className="text-2xl font-semibold">{form.id ? "Edit company" : "Review a company"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rating 2 gives a company's jobs preference. Rating 0 blocks new jobs from that company —
          explain why in the description.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-name">Company name</Label>
            <Input id="c-name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-rating">Overall rating</Label>
            <select
              id="c-rating"
              className="h-9 w-full rounded-md border border-input bg-secondary px-2 text-sm"
              value={form.rating}
              onChange={(e) => set({ rating: Number(e.target.value) })}
            >
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-loc">Office location</Label>
            <Input
              id="c-loc"
              value={form.office_location}
              onChange={(e) => set({ office_location: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-size">Company size</Label>
            <Input
              id="c-size"
              placeholder="e.g. 200–500 employees"
              value={form.company_size}
              onChange={(e) => set({ company_size: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="c-desc">Description</Label>
          <Textarea
            id="c-desc"
            rows={5}
            placeholder="What you know about the company, and why you rated it this way."
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : form.id ? "Save changes" : "Add company"}
          </Button>
          {form.id && (
            <Button variant="ghost" onClick={() => setForm(EMPTY)}>
              Cancel
            </Button>
          )}
        </div>
      </section>

      <h2 className="mt-10 text-xl font-semibold">Your companies</h2>
      <div className="mt-4 space-y-3">
        {companies.data?.length === 0 && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            No companies reviewed yet.
          </div>
        )}
        {companies.data?.map((c) => (
          <div key={c.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold">{c.name}</span>
                  <Badge variant={c.rating === 0 ? "destructive" : c.rating === 2 ? "default" : "secondary"}>
                    {c.rating === 0 ? "Avoid" : c.rating === 2 ? "Favorite" : "Neutral"} · {c.rating}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[c.office_location, c.company_size].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Edit"
                  onClick={() => {
                    setForm({ ...c });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete"
                  onClick={async () => {
                    if (!confirm(`Delete ${c.name}?`)) return;
                    await supabase.from("companies").delete().eq("id", c.id);
                    queryClient.invalidateQueries({ queryKey: ["companies"] });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            {c.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm">{c.description}</p>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
