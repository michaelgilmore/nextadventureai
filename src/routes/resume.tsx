import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Star, Trash2, Upload } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { saveCoverLetterSeed } from "@/lib/documents.functions";
import { saveGoals } from "@/lib/profile.functions";
import { saveResume, setPrimaryResume } from "@/lib/resumes.functions";

export const Route = createFileRoute("/resume")({
  head: () => ({
    meta: [
      { title: "Your resumes — NextAdventureAI" },
      {
        name: "description",
        content:
          "Upload your primary resume so every saved job posting is scored against your real experience.",
      },
      { property: "og:title", content: "Your resumes — NextAdventureAI" },
      {
        property: "og:description",
        content: "Upload the resume NextAdventureAI uses to score each job posting out of 100.",
      },
    ],
  }),
  component: ResumePage,
});

function ResumePage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const upload = useServerFn(saveResume);
  const makePrimary = useServerFn(setPrimaryResume);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [goals, setGoals] = useState("");
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const storeGoals = useServerFn(saveGoals);
  const storeSeed = useServerFn(saveCoverLetterSeed);
  const [seed, setSeed] = useState("");

  useQuery({
    queryKey: ["profile-goals", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("goals, cover_letter_seed")
        .maybeSingle();
      if (error) throw error;
      if (!goalsLoaded) {
        setGoals(data?.goals ?? "");
        setSeed(data?.cover_letter_seed ?? "");
        setGoalsLoaded(true);
      }
      return data ?? { goals: "", cover_letter_seed: "" };
    },
  });

  const goalsMutation = useMutation({
    mutationFn: async () => storeGoals({ data: { goals } }),
    onSuccess: () => toast.success("Goals and preferences saved."),
    onError: (error: Error) => toast.error(error.message),
  });

  const seedMutation = useMutation({
    mutationFn: async () => storeSeed({ data: { seed } }),
    onSuccess: () => toast.success("Cover letter seed info saved."),
    onError: (error: Error) => toast.error(error.message),
  });

  const resumes = useQuery({
    queryKey: ["resumes", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let base64: string | undefined;
      if (file) {
        const buffer = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
        base64 = btoa(binary);
      }
      return upload({
        data: {
          title: title || file?.name || "My resume",
          fileName: file?.name,
          mimeType: file?.type,
          base64,
          text: pasted || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Resume saved.");
      setTitle("");
      setFile(null);
      setPasted("");
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading) return <AppShell>Loading…</AppShell>;

  if (!user) {
    return (
      <AppShell>
        <div className="panel p-8 text-center">
          <p className="text-muted-foreground">Sign in to manage your resumes.</p>
          <Button asChild className="mt-4">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Resumes</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Your primary resume is the one every job posting gets scored against.
      </p>

      <section className="panel mt-8 p-6">
        <h2 className="text-lg font-semibold">Goals &amp; preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Write a paragraph about what you're looking for — role, industry, salary, location, work
          model, deal-breakers. Every job you add is scored with this in mind.
        </p>
        <Textarea
          className="mt-4"
          rows={5}
          placeholder="I'm looking for a senior backend role at a product company, remote or hybrid in the Boston area, ideally in climate or health tech. I want to keep working in Python and avoid on-call heavy ops roles. Minimum $180k base."
          value={goals}
          onChange={(event) => setGoals(event.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button disabled={goalsMutation.isPending} onClick={() => goalsMutation.mutate()}>
            {goalsMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Re-score a saved job from its page to apply changes.
          </span>
        </div>
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="text-lg font-semibold">Cover letter seed info</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Stories, achievements, motivations or phrases you'd like woven into generated cover
          letters. You can turn this on or off each time you generate one.
        </p>
        <Textarea
          className="mt-4"
          rows={5}
          placeholder="I led the migration that cut our cloud bill by 30%. I'm drawn to mission-driven teams because…"
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
        />
        <Button className="mt-3" disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
          {seedMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr]">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold">Add a resume</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Name</Label>
              <Input
                id="title"
                placeholder="Senior product designer 2026"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">PDF or text file</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.txt,.md,text/plain,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pasted">Or paste the text</Label>
              <Textarea
                id="pasted"
                rows={6}
                placeholder="Paste your resume here if you'd rather not upload a file."
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={saveMutation.isPending || (!file && !pasted.trim())}
              onClick={() => saveMutation.mutate()}
            >
              <Upload className="size-4" />
              {saveMutation.isPending ? "Reading resume…" : "Save resume"}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          {resumes.data?.length === 0 && (
            <div className="panel p-6 text-sm text-muted-foreground">No resumes yet.</div>
          )}
          {resumes.data?.map((resume) => (
            <div key={resume.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{resume.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {resume.is_primary ? "Primary" : "Backup"} ·{" "}
                    {new Date(resume.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!resume.is_primary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Make primary"
                      onClick={async () => {
                        await makePrimary({ data: { resumeId: resume.id } });
                        queryClient.invalidateQueries({ queryKey: ["resumes"] });
                        toast.success("Primary resume updated.");
                      }}
                    >
                      <Star className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    onClick={async () => {
                      await supabase.from("resumes").delete().eq("id", resume.id);
                      queryClient.invalidateQueries({ queryKey: ["resumes"] });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                {resume.content_text.slice(0, 300)}
              </p>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
