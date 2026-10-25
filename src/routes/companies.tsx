import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Pencil, Trash2, X } from "lucide-react";

import { AppShell, ScoreDial } from "@/components/AppShell";
import { statusLabel } from "@/components/JobStatus";
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
        content:
          "Review companies, note their size and offices, and rate them to steer your job search.",
      },
      { property: "og:title", content: "Company reviews — NextAdventureAI" },
      {
        property: "og:description",
        content:
          "Rate companies as favorites or ones to avoid so job postings are filtered and scored accordingly.",
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

type CompanySort = "rating" | "rating_asc" | "name" | "jobs" | "recent";

const COMPANY_SORT_OPTIONS: { value: CompanySort; label: string }[] = [
  { value: "rating", label: "Rating (favorites first)" },
  { value: "rating_asc", label: "Rating (avoid first)" },
  { value: "name", label: "Name (A–Z)" },
  { value: "jobs", label: "Most jobs" },
  { value: "recent", label: "Recently added" },
];

/** Rating filter: "all" keeps every company; a number keeps only that rating. */
type RatingFilter = "all" | 0 | 1 | 2;

const RATING_FILTER_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: "all", label: "All companies" },
  { value: 2, label: "Favorites (2)" },
  { value: 1, label: "Neutral (1)" },
  { value: 0, label: "Avoid (0)" },
];

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

/** Company names are matched ignoring case and surrounding spaces. */
const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

function CompaniesPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [sort, setSort] = useState<CompanySort>("rating");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");

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

  // Job postings are matched to companies by name, so they can be listed per company
  // and counted on each row without a per-company request.
  const postings = useQuery({
    queryKey: ["companyPostings", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, title, company, location, workplace_type, status, match_score, is_active, created_at, url",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const counts = new Map<string, number>();
  for (const job of postings.data ?? []) {
    const key = norm(job.company);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const companyJobs = selected
    ? (postings.data ?? []).filter((job) => norm(job.company) === norm(selected.name))
    : [];

  // Ranking (rating) drives both the filter and the default sort order.
  const visible = (companies.data ?? [])
    .filter((c) => ratingFilter === "all" || c.rating === ratingFilter)
    .sort((a, b) => {
      switch (sort) {
        case "rating_asc":
          return a.rating - b.rating || a.name.localeCompare(b.name);
        case "name":
          return a.name.localeCompare(b.name);
        case "jobs":
          return (
            (counts.get(norm(b.name)) ?? 0) - (counts.get(norm(a.name)) ?? 0) ||
            a.name.localeCompare(b.name)
          );
        case "recent":
          return b.created_at.localeCompare(a.created_at);
        default:
          return b.rating - a.rating || a.name.localeCompare(b.name);
      }
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
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <AppShell>Loading…</AppShell>;
  if (!user) return <AppShell>Sign in to review companies.</AppShell>;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const openCompany = (company: { id: string; name: string }) => {
    const row = companies.data?.find((c) => c.id === company.id);
    if (!row) return;
    setForm({ ...row });
    setSelected({ id: row.id, name: row.name });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
            <Button
              variant="ghost"
              onClick={() => {
                setForm(EMPTY);
                setSelected(null);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </section>

      {selected && (
        <section className="panel mt-10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">
                Jobs at <span className="font-display">{selected.name}</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {companyJobs.length} saved {companyJobs.length === 1 ? "posting" : "postings"} from
                this company.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close company jobs"
              onClick={() => setSelected(null)}
            >
              <X className="size-4" />
              Close
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {companyJobs.length === 0 && (
              <div className="panel p-8 text-center text-sm text-muted-foreground">
                No job postings saved for {selected.name} yet.
              </div>
            )}
            {companyJobs.map((job) => (
              <div
                key={job.id}
                className={`panel flex items-center gap-4 p-4 ${job.is_active ? "" : "opacity-60"}`}
              >
                <ScoreDial score={job.match_score} />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/jobs/$jobId"
                    params={{ jobId: job.id }}
                    className="font-display text-base font-semibold hover:text-primary"
                  >
                    {job.title ?? "Untitled role"}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">
                    {[job.location, job.workplace_type].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Added {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant="secondary">
                    {statusLabel(job.status)}
                  </Badge>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open posting <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="mt-10 text-xl font-semibold">Your companies</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a company to edit it and see the jobs you've saved from it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Show
          <select
            className="rounded-md border border-input bg-secondary px-2 py-1 text-sm text-foreground"
            value={String(ratingFilter)}
            onChange={(event) => {
              const next = event.target.value;
              setRatingFilter(next === "all" ? "all" : (Number(next) as RatingFilter));
            }}
          >
            {RATING_FILTER_OPTIONS.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Sort by
          <select
            className="rounded-md border border-input bg-secondary px-2 py-1 text-sm text-foreground"
            value={sort}
            onChange={(event) => setSort(event.target.value as CompanySort)}
          >
            {COMPANY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-muted-foreground">
          {visible.length} {visible.length === 1 ? "company" : "companies"}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {visible.length === 0 && (
          <div className="panel p-8 text-center text-sm text-muted-foreground">
            {companies.data && companies.data.length > 0
              ? "No companies match this filter."
              : "No companies reviewed yet."}
          </div>
        )}
        {visible.map((c) => {
          const jobCount = counts.get(norm(c.name)) ?? 0;
          const isOpen = selected?.id === c.id;
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`Edit ${c.name} and see its ${jobCount} saved jobs`}
              onClick={() => openCompany(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openCompany(c);
                }
              }}
              className={`panel cursor-pointer p-5 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                isOpen ? "border-primary/60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold">{c.name}</span>
                    <Badge
                      variant={
                        c.rating === 0 ? "destructive" : c.rating === 2 ? "default" : "secondary"
                      }
                    >
                      {c.rating === 0 ? "Avoid" : c.rating === 2 ? "Favorite" : "Neutral"} ·{" "}
                      {c.rating}
                    </Badge>
                    <Badge variant="outline">
                      {jobCount} {jobCount === 1 ? "job" : "jobs"}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      openCompany(c);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Delete"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete ${c.name}?`)) return;
                      await supabase.from("companies").delete().eq("id", c.id);
                      if (selected?.id === c.id) setSelected(null);
                      queryClient.invalidateQueries({ queryKey: ["companies"] });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {c.description && <p className="mt-3 whitespace-pre-wrap text-sm">{c.description}</p>}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
