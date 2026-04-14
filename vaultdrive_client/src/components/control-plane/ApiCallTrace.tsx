interface ApiCallTraceProps {
  method: string;
  path: string;
  scope?: string;
  note?: string;
}

export function ApiCallTrace({ method, path, scope, note }: ApiCallTraceProps) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/12 px-3 py-3 text-sm text-white/85">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
        Underlying API call
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-primary/90">
          {method}
        </span>
        <code className="rounded-md bg-card px-2 py-1 text-[11px] text-muted-foreground">
          {`${method} ${path}`}
        </code>
        {scope ? (
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/75">
            {scope}
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-xs leading-relaxed text-white/75">{note}</p> : null}
    </div>
  );
}
