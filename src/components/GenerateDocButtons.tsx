import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileText, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateDocument } from "@/lib/documents.functions";

type Kind = "resume" | "cover_letter";

export function GenerateDocButtons({ jobId, fileBase }: { jobId: string; fileBase: string }) {
  const generate = useServerFn(generateDocument);
  const [kind, setKind] = useState<Kind | null>(null);
  const [useSeed, setUseSeed] = useState(true);
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: (k: Kind) => generate({ data: { jobId, kind: k, useSeed } }),
    onSuccess: (res) => setText(res.text),
    onError: (e: Error) => toast.error(e.message),
  });

  const open = (k: Kind) => {
    setKind(k);
    setText("");
    if (k === "resume") mutation.mutate(k);
  };

  const label = kind === "resume" ? "Custom resume" : "Custom cover letter";

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase}-${kind === "resume" ? "resume" : "cover-letter"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <Button size="sm" onClick={() => open("resume")}>
        <FileText className="size-3" /> Custom resume
      </Button>
      <Button size="sm" onClick={() => open("cover_letter")}>
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
            <p className="py-10 text-center text-muted-foreground">Writing… this can take up to a minute.</p>
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
                <Button size="sm" variant="secondary" onClick={download}>
                  <Download className="size-3" /> Download
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
