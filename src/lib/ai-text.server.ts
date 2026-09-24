export async function aiText(args: { instructions: string; input: string }): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app yet.");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: args.instructions,
      input: args.input,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
    }),
  });

  if (!response.ok || !response.body) {
    const body = await response.text();
    if (response.status === 429) throw new Error("The AI service is busy. Please try again shortly.");
    if (response.status === 402 || response.status === 403)
      throw new Error("AI usage is unavailable right now — the workspace needs more AI credits.");
    console.error(`AI gateway error [${response.status}]: ${body}`);
    throw new Error(`The AI service returned an error (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const evt = JSON.parse(raw) as { type?: string; delta?: string };
        if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
      } catch {
        /* ignore partial */
      }
    }
  }
  if (!text.trim()) throw new Error("The AI returned an empty document. Please try again.");
  return text.trim();
}
