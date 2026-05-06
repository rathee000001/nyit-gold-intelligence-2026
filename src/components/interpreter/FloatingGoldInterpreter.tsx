
"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: string[];
};

type ApiResponse = {
  answer: string;
  mode?: string;
  sources?: string[];
  suggestions?: string[];
  page?: {
    page: string;
    summary: string;
  };
};

const STARTER_SUGGESTIONS = [
  "What does this page explain?",
  "Explain Omega in business language.",
  "Why is Gamma context-only?",
  "Which artifacts support this page?",
];

function modeLabel(mode?: string) {
  if (!mode) return "Gold AI";
  if (mode === "artifact_blob_ai") return "Artifact Blob AI";
  if (mode === "general_ai") return "General AI";
  if (mode === "artifact_fallback") return "Artifact Fallback";
  if (mode === "needs_openrouter_key") return "Needs API Key";
  if (mode === "openrouter_api_error") return "AI Provider Error";
  return mode.replaceAll("_", " ");
}

function SourceChips({ sources }: { sources?: string[] }) {
  const uniqueSources = Array.from(new Set(sources || [])).filter(Boolean);

  if (uniqueSources.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {uniqueSources.slice(0, 6).map((source) => (
        <span
          key={source}
          className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700"
        >
          {source}
        </span>
      ))}
      {uniqueSources.length > 6 ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
          +{uniqueSources.length - 6} more
        </span>
      ) : null}
    </div>
  );
}

function RobotIcon() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-blue-600 shadow-2xl shadow-blue-900/25">
      <div className="absolute inset-1 rounded-full bg-slate-950/85" />
      <div className="relative z-10 text-xl font-black text-white">AI</div>
      <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
    </div>
  );
}

export default function FloatingGoldInterpreter() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi — I am Gold AI. I can read the approved artifact blobs for this page, explain charts and models, and answer general questions separately when needed.",
      mode: "artifact_blob_ai",
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSuggestions, setLastSuggestions] = useState(STARTER_SUGGESTIONS);
  const [currentPage, setCurrentPage] = useState("/");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCurrentPage(window.location.pathname);
  }, []);

  useEffect(() => {
    if (open) {
      setCurrentPage(window.location.pathname);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages.length]);

  async function ask(questionOverride?: string) {
    const question = (questionOverride || input).trim();
    if (!question || busy) return;

    const pagePath = window.location.pathname;
    setCurrentPage(pagePath);

    const userMessage: ChatMessage = { role: "user", content: question };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/gold-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          pagePath,
          history: nextMessages.slice(-8),
        }),
      });

      const data: ApiResponse = await response.json();

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || "I could not generate an answer from the available artifact blobs.",
          mode: data.mode,
          sources: data.sources,
        },
      ]);

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setLastSuggestions(data.suggestions);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Gold AI connection error: ${error.message}`
              : "Gold AI connection error.",
          mode: "error",
          sources: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-[9998] flex items-center gap-3 rounded-full border border-white/40 bg-slate-950 px-4 py-3 text-white shadow-2xl shadow-slate-900/30 transition duration-300 hover:-translate-y-1 hover:bg-slate-900 ${
          open ? "pointer-events-none scale-95 opacity-0" : "opacity-100"
        }`}
        aria-label="Open Gold AI"
      >
        <RobotIcon />
        <div className="hidden text-left md:block">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-300">
            Gold AI
          </p>
          <p className="text-sm font-black">Ask this page</p>
        </div>
      </button>

      {open ? (
        <div className="fixed bottom-5 right-5 z-[9999] flex h-[min(790px,calc(100vh-40px))] w-[min(500px,calc(100vw-28px))] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.25),_transparent_30%),linear-gradient(135deg,_#05070d_0%,_#0b1728_70%,_#000_100%)] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <RobotIcon />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-yellow-300">
                    Gold Nexus Alpha
                  </p>
                  <h3 className="mt-1 text-xl font-black">Artifact Blob AI</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Page-aware answers from JSON/CSV artifacts.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-black text-white hover:bg-white/20"
                aria-label="Close Gold AI"
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Artifact blobs
              </span>
              <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
                Current page: {currentPage}
              </span>
              <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-200">
                Professor-safe
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[86%] rounded-[1.3rem] bg-blue-600 p-4 text-white shadow-lg"
                    : "mr-auto max-w-[94%] rounded-[1.3rem] border border-slate-200 bg-white p-4 text-slate-900 shadow-sm"
                }
              >
                {message.role === "assistant" ? (
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      {modeLabel(message.mode)}
                    </span>
                  </div>
                ) : null}

                <div className="whitespace-pre-wrap text-sm leading-7">
                  {message.content}
                </div>

                {message.role === "assistant" ? <SourceChips sources={message.sources} /> : null}
              </div>
            ))}

            {busy ? (
              <div className="mr-auto max-w-[94%] rounded-[1.3rem] border border-slate-200 bg-white p-4 text-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:240ms]" />
                  <span className="ml-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Searching artifact blobs
                  </span>
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {lastSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => ask(suggestion)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask what this page shows, why the model works, or where a metric comes from..."
                rows={2}
                className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              />

              <button
                type="button"
                onClick={() => ask()}
                disabled={busy || input.trim() === ""}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Send
              </button>
            </div>

            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Project answers are grounded in selected artifact blobs. General AI answers are labeled separately.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
