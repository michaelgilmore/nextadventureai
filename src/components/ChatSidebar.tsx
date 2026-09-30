import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useCreateThread() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useThreads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["threads", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function ChatSidebar({ activeId }: { activeId?: string }) {
  const threads = useThreads();
  const create = useCreateThread();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <aside className="panel flex w-full flex-col gap-2 p-3 md:w-60 md:shrink-0">
      <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
        <MessageSquarePlus className="size-4" /> New chat
      </Button>
      <div className="mt-1 flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
        {threads.data?.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">No chats yet.</p>
        )}
        {threads.data?.map((t) => (
          <div
            key={t.id}
            className={`group flex items-center gap-1 rounded-md ${t.id === activeId ? "bg-secondary" : "hover:bg-secondary/60"}`}
          >
            <Link
              to="/chat/$threadId"
              params={{ threadId: t.id }}
              className="min-w-0 flex-1 truncate px-2 py-2 text-sm"
            >
              {t.title}
            </Link>
            <button
              type="button"
              aria-label="Delete chat"
              className="p-2 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              onClick={async () => {
                const { error } = await supabase.from("chat_threads").delete().eq("id", t.id);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                queryClient.invalidateQueries({ queryKey: ["threads"] });
                if (t.id === activeId) navigate({ to: "/chat" });
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
