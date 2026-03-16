interface ApiCallTraceProps {
  method: string;
  path: string;
  scope?: string;
  note?: string;
}

export function ApiCallTrace({ method, path, scope, note }: ApiCallTraceProps) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-3 text-sm text-white/85">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
        Underlying API call
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#6b4345]">
          {method}
        </span>
        <code className="rounded-md bg-[#2a1f1f] px-2 py-1 text-[11px] text-[#f7ecec]">
          {`${method} ${path}`}
        </code>
        {scope ? (
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/70">
            {scope}
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-xs leading-relaxed text-white/65">{note}</p> : null}
    </div>
  );
}
