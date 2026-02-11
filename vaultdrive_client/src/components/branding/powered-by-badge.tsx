import FilemonAvatar from "./filemon-avatar";

export default function PoweredByBadge({ className = "flex items-center gap-2 text-muted-foreground text-sm" }: { className?: string }) {
  return (
    <div className={className}>
      <FilemonAvatar className="w-6 h-6 rounded-full" />
      <span className="opacity-75">Powered by</span>
      <span className="font-semibold text-foreground">Filemon Prime</span>
    </div>
  );
}