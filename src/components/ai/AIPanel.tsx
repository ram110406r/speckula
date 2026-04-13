"use client";

import { Button } from "@/components/ui/button";
import { X, Sparkles, Wand2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useChat, type UIMessage } from "@ai-sdk/react";

export function AIPanel() {
  const { toggleAiPanel } = useAppStore();
  const { 
    messages = [], 
    input = "", 
    handleInputChange = () => {}, 
    handleSubmit = (e: any) => { e?.preventDefault() }, 
    isLoading = false 
  } = useChat() as any;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between border-b border-border h-14 px-4 shrink-0">
        <div className="flex items-center gap-2 font-medium text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </div>
        <Button variant="ghost" size="icon" onClick={toggleAiPanel} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <>
              <div className="rounded-lg bg-background p-3 text-sm border border-border shadow-sm">
                <p className="text-muted-foreground">
                  Highlight text in the editor or ask a question below to get insights.
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="justify-start text-xs border-primary/20 hover:border-primary/50 text-foreground">
                  <Wand2 className="mr-2 h-3 w-3 text-primary" /> Generate PRD
                </Button>
                <Button variant="outline" className="justify-start text-xs text-foreground">
                   Extract Insights
                </Button>
                <Button variant="outline" className="justify-start text-xs text-foreground">
                   Suggest Execution Tasks
                </Button>
              </div>
            </>
          ) : (
            messages.map((m: any) => (
              <div key={m.id} className={`p-3 rounded-lg text-sm shadow-sm ${m.role === 'user' ? 'bg-primary/10 text-foreground ml-4' : 'bg-background border border-border mr-4'}`}>
                <span className="font-semibold text-xs mb-1 block text-muted-foreground">{m.role === 'user' ? 'You' : 'Buildcase AI'}</span>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))
          )}
          {isLoading && <div className="text-xs text-muted-foreground animate-pulse p-2">Thinking...</div>}
        </div>
      </div>
      <div className="p-4 border-t border-border mt-auto shrink-0 bg-sidebar">
        <form className="relative" onSubmit={handleSubmit}>
          <textarea 
            value={input}
            onChange={handleInputChange}
            className="w-full min-h-[80px] text-sm resize-none rounded-md border border-input bg-background px-3 py-2 pr-16 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Ask Buildcase..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !input?.trim()} size="sm" className="absolute bottom-2 right-2 h-7 rounded bg-primary text-primary-foreground hover:bg-primary/90">
            Ask
          </Button>
        </form>
      </div>
    </div>
  );
}
