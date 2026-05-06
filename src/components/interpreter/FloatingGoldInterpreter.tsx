
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  sources?: string[];
};

type ApiResponse = {
  answer?: string;
  mode?: string;
  sources?: string[];
  suggestions?: string[];
};

const STARTER_SUGGESTIONS = [
  "What does this page explain?",
  "Explain the model on this page in business language.",
  "Which artifacts support this page?",
  "What should I look at first?",
];

function pageSuggestions(pathname: string) {
  if (pathname.includes("final-deep-ml-evaluation")) {
    return [
      "Explain the selected Deep ML forecast.",
      "Why is Omega the final selected layer?",
      "What does the 95% band mean?",
      "Which artifacts support this forecast?",
    ];
  }

  if (pathname.includes("data-matrix")) {
    return [
      "Explain this Data Matrix page.",
      "What are Step 10, 10A, and 11?",
      "Which matrix artifacts are loaded?",
      "Explain the live gold data patch.",
    ];
  }

  if (pathname.includes("omega-fusion")) {
    return [
      "Explain Omega Fusion.",
      "How does Omega combine experts?",
      "Which weights are used?",
      "Why is Omega not a guarantee?",
    ];
  }

  if (pathname.includes("gamma-news-sensitivity")) {
    return [
      "Explain Gamma sensitivity.",
      "Is Gamma causal or contextual?",
      "What news context is used?",
      "How does Gamma connect to Omega?",
    ];
  }

  if (pathname.includes("gold-ai")) {
    return [
      "Explain the AI Studio.",
      "How does the artifact blob work?",
      "Which files can this AI read?",
      "How can I generate charts from artifacts?",
    ];
  }

  return STARTER_SUGGESTIONS;
}

function modeLabel(mode?: string) {
  if (!mode) return "Gold AI";
  if (mode === "artifact_blob_ai") return "Artifact Blob AI";
  if (mode === "general_ai") return "General AI";
  if (mode === "artifact_fallback") return "Artifact Fallback";
  if (mode === "needs_openrouter_key") return "Needs API Key";
  if (mode === "openrouter_api_error") return "AI Provider Error";
  if (mode === "deep_ml_forecast_ai") return "Deep ML Forecast AI";
  return mode.replaceAll("_", " ");
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

function SourceChips({ sources }: { sources?: string[] }) {
  const unique = Array.from(new Set(sources || [])).filter(Boolean);

  if (!unique.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {unique.slice(0, 6).map((source) => (
        <span
          key={source}
          className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-700"
        >
          {source}
        </span>
      ))}

      {unique.length > 6 ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">
          +{unique.length - 6} more
        </span>
      ) : null}
    </div>
  );
}

export default function FloatingGoldInterpreter() {
  const pathname = usePathname() || "/";
  const suggestions = useMemo(() => pageSuggestions(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      mode: "artifact_blob_ai",
      content:
        "Hi — I am the floating Gold AI assistant. I am connected to the same artifact blob system as the full Gold AI Studio. I can explain this page, read approved JSON/CSV artifacts, and send you to the full AI House for deeper chart/table work.",
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>(suggestions);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setLastSuggestions(pageSuggestions(pathname));
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, messages.length]);

  async function ask(questionOverride?: string) {
    const question = (questionOverride || input).trim();
    if (!question || busy) return;

    const userMessage: ChatMessage = { role: "user", content: question };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/gold-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          pagePath: pathname,
          history: nextMessages.slice(-8),
        }),
      });

      const data: ApiResponse = await response.json();

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.answer ||
            "I could not generate an answer from the available artifact blobs.",
          mode: data.mode || "artifact_blob_ai",
          sources: data.sources || [],
        },
      ]);

      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        setLastSuggestions(data.suggestions);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          mode: "error",
          content:
            error instanceof Error
              ? `Gold AI connection error: ${error.message}`
              : "Gold AI connection error.",
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
        className={`fixed bottom-4 right-4 z-[9998] sm:bottom-6 sm:right-6 flex items-center gap-3 rounded-full border border-white/40 bg-slate-950 px-4 py-3 text-white shadow-2xl shadow-slate-900/30 transition duration-300 hover:-translate-y-1 hover:bg-slate-900 ${
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
          <p className="text-[10px] font-bold text-slate-300">
            AI House connected
          </p>
        </div>
      </button>

      {open ? (
        <div className="fixed inset-x-3 bottom-3 z-[9999] flex h-[min(760px,calc(100vh-24px))] w-auto sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(520px,calc(100vw-28px))] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.25),_transparent_30%),linear-gradient(135deg,_#05070d_0%,_#0b1728_70%,_#000_100%)] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <RobotIcon />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-yellow-300">
                    Gold Nexus Alpha
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    Artifact Blob AI
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Page-aware answers from JSON/CSV artifacts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/gold-ai"
                  className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-yellow-200 hover:bg-yellow-300/20"
                  onClick={() => setOpen(false)}
                >
                  AI House
                </Link>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-black text-white hover:bg-white/20"
                  aria-label="Close Gold AI"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Artifact blobs
              </span>
              <span className="max-w-full rounded-full border border-blue-300/30 bg-blue-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
                Current page: {pathname}
              </span>
              <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-200">
                Professor-safe
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
                Floating assistant mode
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
                Quick page help here. Full artifact search, chart/table lab, and deeper AI work live in Gold AI Studio.
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
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

                {message.role === "assistant" ? (
                  <SourceChips sources={message.sources} />
                ) : null}
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
              {(lastSuggestions.length ? lastSuggestions : suggestions).map((suggestion) => (
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

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[11px] leading-5 text-slate-500">
                Project answers are grounded in selected artifact blobs. General AI answers are labeled separately.
              </p>

              <Link
                href="/gold-ai"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100"
              >
                Open AI House
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
