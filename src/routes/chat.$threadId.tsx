import { useChat } from "@ai-sdk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useMemo } from "react";
import { toast } from "sonner";

import scoutAvatar from "@/assets/scout-avatar.jpg";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { AppShell } from "@/components/AppShell";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat — NextAdventureAI" },
      { name: "description", content: "A conversation with Scout about your job search." },
      { property: "og:title", content: "Chat — NextAdventureAI" },
      { property: "og:description", content: "A conversation with Scout about your job search." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

const TOOL_TITLES: Record<string, string> = {
  list_saved_jobs: "Looked up saved jobs",
  get_job_details: "Read job details",
  web_search: "Searched the web",
};

function ChatPage() {
  const { threadId } = Route.useParams();
  const { user, loading } = useAuth();

  const thread = useQuery({
    queryKey: ["thread", threadId],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, messages")
        .eq("id", threadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <AppShell>Loading…</AppShell>;
  if (!user) return <AppShell>Please sign in to chat.</AppShell>;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row">
        <ChatSidebar activeId={threadId} />
        <div className="panel flex h-[75vh] min-w-0 flex-1 flex-col p-4">
          {thread.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading chat…</p>
          ) : !thread.data ? (
            <p className="text-sm text-muted-foreground">This chat isn't available.</p>
          ) : (
            <ChatWindow
              key={threadId}
              threadId={threadId}
              initialMessages={(thread.data.messages as unknown as UIMessage[]) ?? []}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ChatWindow({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const queryClient = useQueryClient();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (error) => {
      const msg = error.message || "";
      if (msg.includes("402") || msg.toLowerCase().includes("credit"))
        toast.error("AI credits have run out for this workspace.");
      else if (msg.includes("429")) toast.error("The AI is busy. Please try again in a moment.");
      else toast.error(msg.startsWith("{") ? (JSON.parse(msg).error ?? "Something went wrong.") : msg || "Something went wrong.");
    },
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const waiting =
    busy && (!last || last.role === "user" || !last.parts.some((p) => p.type === "text" && p.text));

  return (
    <>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<img src={scoutAvatar} alt="Scout" width={56} height={56} className="rounded-xl" />}
              title="Ask Scout anything"
              description='Try "Which of my saved jobs is the best fit?" or "What is it like to work at Stripe?"'
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text")
                      return <MessageResponse key={i}>{part.text}</MessageResponse>;
                    if (isToolUIPart(part)) {
                      const name = part.type.replace(/^tool-/, "");
                      return (
                        <Tool key={i} defaultOpen={false}>
                          <ToolHeader
                            type={part.type}
                            state={part.state}
                            title={TOOL_TITLES[name] ?? name}
                          />
                          <ToolContent>
                            <ToolInput input={part.input} />
                            <ToolOutput output={part.output} errorText={part.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && <Shimmer>Thinking…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        className="mt-3"
        onSubmit={({ text }) => {
          if (!text.trim() || busy) return;
          sendMessage({ text }, { body: { id: threadId } });
        }}
      >
        <PromptInputTextarea autoFocus placeholder="Ask about your jobs or a company…" />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </>
  );
}
