import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileText, Mail } from "lucide-react";
import { Packer } from "docx";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateDocument } from "@/lib/documents.functions";
import { buildApplicationDocument } from "@/lib/application-docx";

type Kind = "resume" | "cover_letter";

export function GenerateDocButtons({ jobId, fileBase }: { jobId: string; fileBase: string }) {
  const generate = useServerFn(generateDocument);
  const [kind, setKind] = useState<Kind | null>(null);
  const [useSeed, setUseSeed] = useState(true);
  const [text, setText] = useState("");
  const [prepared, setPrepared] = useState<{ text: string; blob: Blob } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const mutation = useMutation({
    mutationFn: (k: Kind) => generate({ data: { jobId, kind: k, useSeed } }),
    onMutate: () => { setText(""); setPrepared(null); },
    onSuccess: (res) => {
      const bytes = Uint8Array.from(atob(res.docxBase64), (character) => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      setPrepared({ text: res.text, blob });
      setText(res.text);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = (k: Kind) => {
    setKind(k);
    setText("");
    setPrepared(null);
    if (k === "resume") mutation.mutate(k);
  };

  const label = kind === "resume" ? "Custom resume" : "Custom cover letter";

  const download = async () => {
    if (!kind || downloading || mutation.isPending) return;
    setDownloading(true);
    try {
      const blob = prepared?.text === text
        ? prepared.blob
        : await Packer.toBlob(buildApplicationDocument(text, kind));
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `${fileBase}-${kind === "resume" ? "resume" : "cover-letter"}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the document.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Button size="sm" disabled={mutation.isPending} onClick={() => open("resume")}>
        <FileText className="size-3" /> Custom resume
      </Button>
      <Button size="sm" disabled={mutation.isPending} onClick={() => open("cover_letter")}>
        <Mail className="size-3" /> Custom cover letter
      </Button>

      <Dialog open={kind !== null} onOpenChange={(o) => !o && setKind(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {kind === "cover_letter" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id="seed" checked={useSeed} onCheckedChange={(v) => setUseSeed(v === true)} />
                <Label htmlFor="seed">Use my cover letter seed info</Label>
              </div>
              <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate("cover_letter")}>
                {text ? "Regenerate" : "Generate"}
              </Button>
            </div>
          )}
          {mutation.isPending ? (
            <p className="py-10 text-center text-muted-foreground">Writing and checking page length…</p>
          ) : text ? (
            <>
              <Textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(text);
                    toast.success("Copied.");
                  }}
                >
                  <Copy className="size-3" /> Copy
                </Button>
                <Button size="sm" variant="secondary" disabled={downloading} onClick={download}>
                  <Download className="size-3" /> {downloading ? "Preparing…" : "Download DOCX"}
                </Button>
                {kind === "resume" && (
                  <Button size="sm" variant="ghost" onClick={() => mutation.mutate("resume")}>
                    Regenerate
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
