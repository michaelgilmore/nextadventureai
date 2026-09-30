import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, isStepCount, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/run-id.server";

const SYSTEM = `You are Scout, the job-search assistant inside NextAdventureAI.
You help the user understand and compare the job postings they have saved, and research companies.
- Use list_saved_jobs to see the user's saved jobs, and get_job_details for the full posting of a specific one. Always look these up instead of guessing.
- Use web_search when the user asks about a company, industry, salaries, news, culture or anything outside their saved data. Cite sources with links.
- Be concise and practical. Use markdown (short lists, bold key facts). Never invent job details.`;

function json(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json(401, "Please sign in.");

        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: authError } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (authError || !userId) return json(401, "Please sign in.");

        const body = (await request.json()) as { id?: string; messages?: UIMessage[] };
        const threadId = z.string().uuid().safeParse(body.id);
        if (!threadId.success || !Array.isArray(body.messages)) return json(400, "Invalid request.");
        const messages = body.messages;

        const { data: thread } = await supabase
          .from("chat_threads")
          .select("id, title")
          .eq("id", threadId.data)
          .maybeSingle();
        if (!thread) return json(404, "Chat not found.");

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json(500, "AI is not configured for this app yet.");

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const tools = {
          list_saved_jobs: tool({
            description: "List all of the user's saved jobs with key fields and match scores.",
            inputSchema: z.object({}),
            execute: async () => {
              const { data, error } = await supabase
                .from("jobs")
                .select(
                  "id, title, company, location, workplace_type, employment_type, seniority, salary, status, is_active, match_score, skills, created_at",
                )
                .order("created_at", { ascending: false });
              if (error) return { error: error.message };
              return { jobs: data };
            },
          }),
          get_job_details: tool({
            description: "Get the full details of one saved job by its id, including description, requirements and match analysis.",
            inputSchema: z.object({ jobId: z.string() }),
            execute: async ({ jobId }) => {
              const { data, error } = await supabase
                .from("jobs")
                .select(
                  "id, title, company, location, workplace_type, employment_type, seniority, salary, description, requirements, skills, status, is_active, match_score, match_summary, strengths, gaps, notes, url",
                )
                .eq("id", jobId)
                .maybeSingle();
              if (error) return { error: error.message };
              return data ?? { error: "Job not found." };
            },
          }),
          web_search: provider.tools.webSearch({}),
        };

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: isStepCount(20),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const firstUser = messages.find((m) => m.role === "user");
        const firstText =
          firstUser?.parts.find((p): p is { type: "text"; text: string } => p.type === "text")?.text ?? "";

        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({
            originalMessages: messages,
            sendReasoning: true,
            onFinish: async ({ messages: finalMessages }) => {
              const update: Database["public"]["Tables"]["chat_threads"]["Update"] = {
                messages: finalMessages as unknown as Database["public"]["Tables"]["chat_threads"]["Update"]["messages"],
                updated_at: new Date().toISOString(),
              };
              if (thread.title === "New chat" && firstText) update.title = firstText.slice(0, 60);
              const { error } = await supabase.from("chat_threads").update(update).eq("id", thread.id);
              if (error) console.error("Failed to save chat:", error.message);
            },
          }),
          runIdFetch,
        );
      },
    },
  },
});
