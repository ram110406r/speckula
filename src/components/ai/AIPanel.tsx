"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Wand2, Lightbulb, ListChecks, Send, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/lib/firebase/AuthProvider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AIPanel() {
  const { toggleAiPanel } = useAppStore();
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add a placeholder assistant message for streaming
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) throw new Error("API error");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        );
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "⚠ The AI engine encountered an error. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const triggerPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border h-14 px-4 shrink-0 bg-sidebar">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAiPanel}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-auto space-y-3 bg-background/30">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-sidebar border border-border p-3 text-sm shadow-sm">
              <p className="text-muted-foreground leading-relaxed">
                {user
                  ? `Welcome back, ${user.displayName?.split(" ")[0] || "there"}! Highlight text in the editor or use a shortcut below.`
                  : "Highlight text in the editor or ask a question below to get insights."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start text-xs border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-foreground h-9"
                onClick={() => triggerPrompt("Generate a comprehensive PRD for this product concept. Include: overview, problem statement, user stories, functional requirements, success metrics, and technical considerations.")}
              >
                <Wand2 className="mr-2 h-3 w-3 text-primary shrink-0" />
                Generate PRD
              </Button>
              <Button
                variant="outline"
                className="justify-start text-xs hover:bg-muted/50 text-foreground h-9"
                onClick={() => triggerPrompt("Extract the key product insights from what I've described. Identify: pain points, target users, market opportunity, and differentiation.")}
              >
                <Lightbulb className="mr-2 h-3 w-3 text-yellow-500 shrink-0" />
                Extract Insights
              </Button>
              <Button
                variant="outline"
                className="justify-start text-xs hover:bg-muted/50 text-foreground h-9"
                onClick={() => triggerPrompt("Based on the product concept described, suggest a prioritized list of execution tasks and milestones for the first 90 days. Format as a structured action plan.")}
              >
                <ListChecks className="mr-2 h-3 w-3 text-green-500 shrink-0" />
                Suggest Execution Tasks
              </Button>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg text-sm shadow-sm p-3 ${
                m.role === "user"
                  ? "bg-primary/10 text-foreground ml-6 border border-primary/20"
                  : "bg-sidebar border border-border mr-6"
              }`}
            >
              <span className="font-semibold text-[10px] uppercase tracking-wider mb-1.5 block text-muted-foreground">
                {m.role === "user" ? "You" : "Buildcase AI"}
              </span>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content || (isLoading ? "▋" : "")}</div>
            </div>
          ))
        )}
        {isLoading && messages.at(-1)?.role === "user" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0 bg-sidebar">
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 h-6 text-[10px] text-muted-foreground hover:text-foreground w-full"
            onClick={() => setMessages([])}
          >
            Clear conversation
          </Button>
        )}
        <form className="relative flex items-end gap-2" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 min-h-[72px] max-h-[160px] text-sm resize-none rounded-lg border border-input bg-background px-3 py-2.5 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring leading-relaxed"
            placeholder="Ask Buildcase..."
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
