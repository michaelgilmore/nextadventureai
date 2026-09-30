import { createFileRoute } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";

import scoutAvatar from "@/assets/scout-avatar.jpg";
import { AppShell } from "@/components/AppShell";
import { ChatSidebar, useCreateThread } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "Ask Scout — NextAdventureAI" },
      {
        name: "description",
        content: "Chat with an AI about your saved job postings or research any company on the web.",
      },
      { property: "og:title", content: "Ask Scout — NextAdventureAI" },
      {
        property: "og:description",
        content: "AI chat for your job search: compare saved roles and research companies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatHome,
});

function ChatHome() {
  const { user, loading } = useAuth();
  const create = useCreateThread();
  if (loading) return <AppShell>Loading…</AppShell>;
  if (!user) return <AppShell>Please sign in to chat.</AppShell>;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row">
        <ChatSidebar />
        <div className="panel flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
          <img src={scoutAvatar} alt="Scout" width={72} height={72} className="rounded-2xl" />
          <h1 className="font-display text-2xl font-semibold">Ask Scout</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Ask about the jobs you've saved, or have Scout look up a company on the internet.
          </p>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <MessageSquarePlus className="size-4" /> Start a new chat
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
