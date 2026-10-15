export default function AnalyzingRequirementsLoading() {
  return (
    <section
      aria-label="Analyzing requirements"
      aria-live="polite"
      className="w-full max-w-lg bg-white text-slate-950"
    >
      <h2 className="mb-3 text-[26px] font-semibold leading-tight tracking-tight">
        Analyzing requirements...
      </h2>

      <div
        role="status"
        className="rounded-[20px] border border-[#e2eaf7] bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
      >
        <svg
          aria-hidden="true"
          className="mb-1 h-4 w-4 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 0 0-2 2v2m12-4h2a2 2 0 0 1 2 2v2M4 16v2a2 2 0 0 0 2 2h2m12-4v2a2 2 0 0 1-2 2h-2M9 12h6" />
        </svg>

        <h3 className="text-lg font-medium leading-6">
          Preparing your results
        </h3>
        <p className="mt-2 text-sm leading-5 text-slate-500">
          Extracting information and organizing requirements.
        </p>

        <div
          role="progressbar"
          aria-label="Analysis progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={100}
          className="mt-6 h-2 overflow-hidden rounded-full bg-blue-100"
        >
          <div className="h-full w-full rounded-full bg-[#2463f6]" />
        </div>

        <p className="mt-6 text-xs leading-4 text-slate-400">
          Simulated AI analysis for this prototype.
        </p>
      </div>
    </section>
  );
}