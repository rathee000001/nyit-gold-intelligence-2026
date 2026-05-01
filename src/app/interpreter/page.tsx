import FloatingGoldInterpreter from "@/components/interpreter/FloatingGoldInterpreter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InterpreterPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.2),_transparent_32%),linear-gradient(135deg,_#05070d_0%,_#0b1728_55%,_#000_100%)] px-6 py-16 text-white md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-yellow-300">
            Gold Nexus Alpha
          </p>

          <h1 className="mt-5 text-5xl font-black tracking-tight md:text-7xl">
            Forecast Interpreter
          </h1>

          <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300 md:text-lg">
            Use the floating chat button in the bottom-right corner. The
            interpreter answers Gold Nexus Alpha questions from approved JSON
            artifacts and can also answer general forecasting questions when the
            AI API key is configured.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-200">
                Project Mode
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                Uses approved JSON artifacts only for project-specific claims.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                General Mode
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                Answers general forecasting questions when OPENAI_API_KEY is
                available.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                Source Chips
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                Shows the JSON artifacts used for grounded project answers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-3xl font-black text-slate-950">
            Try these questions
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              "What is the official forecast cutoff?",
              "Which model was selected and why?",
              "Why is high_yield excluded from main models?",
              "Explain the final ARIMA forecast after cutoff.",
              "How many weekday-clean rows are in the matrix?",
              "Explain RMSE in simple terms.",
            ].map((question) => (
              <div
                key={question}
                className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-700"
              >
                {question}
              </div>
            ))}
          </div>
        </div>
      </section>

      <FloatingGoldInterpreter />
    </main>
  );
}
