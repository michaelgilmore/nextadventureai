import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";
import { toast } from "sonner";
import { Check, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { uploadSentDocument } from "@/lib/sent-docs.functions";

type Kind = "resume" | "cover_letter";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SentDocUploads({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const docs = useQuery({
    queryKey: ["sent-docs", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sent_documents")
        .select("id, kind, file_name, include_in_future")
        .eq("job_id", jobId);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <SentDocRow jobId={jobId} kind="resume" doc={docs.data?.find((d) => d.kind === "resume")} onDone={() => qc.invalidateQueries({ queryKey: ["sent-docs", jobId] })} />
      <SentDocRow jobId={jobId} kind="cover_letter" doc={docs.data?.find((d) => d.kind === "cover_letter")} onDone={() => qc.invalidateQueries({ queryKey: ["sent-docs", jobId] })} />
    </div>
  );
}

function SentDocRow({
  jobId,
  kind,
  doc,
  onDone,
}: {
  jobId: string;
  kind: Kind;
  doc: { id: string; file_name: string | null; include_in_future: boolean } | undefined;
  onDone: () => void;
}) {
  const upload = useServerFn(uploadSentDocument);
  const input = useRef<HTMLInputElement>(null);
  const label = kind === "resume" ? "sent resume" : "sent cover letter";
  const include = doc?.include_in_future ?? true;

  const mutation = useMutation({
    mutationFn: async (file: File) =>
      upload({
        data: { jobId, kind, fileName: file.name, mimeType: file.type, base64: await toBase64(file), includeInFuture: include },
      }),
    onSuccess: () => {
      toast.success(`Uploaded ${label}.`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = async (value: boolean) => {
    if (!doc) return;
    const { error } = await supabase.from("sent_documents").update({ include_in_future: value }).eq("id", doc.id);
    if (error) toast.error(error.message);
    onDone();
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
      {doc && (
        <span className="flex max-w-[12rem] items-center gap-1 truncate text-muted-foreground" title={doc.file_name ?? ""}>
          <Check className="size-3 shrink-0 text-success" /> {doc.file_name}
        </span>
      )}
      <label className="flex items-center gap-2 text-muted-foreground">
        <Checkbox checked={include} disabled={!doc} onCheckedChange={(v) => toggle(v === true)} />
        Use in future
      </label>
      <input
        ref={input}
        type="file"
        accept=".docx,.odt,.pdf,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) mutation.mutate(f);
          e.target.value = "";
        }}
      />
      <Button size="sm" variant="secondary" disabled={mutation.isPending} onClick={() => input.current?.click()}>
        <Upload className="size-3" />
        {mutation.isPending ? "Uploading…" : doc ? `Replace ${label}` : `Upload ${label}`}
      </Button>
    </div>
  );
}
