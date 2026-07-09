import { SKINS, useTheme } from "./theme-provider";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { skin, setSkin } = useTheme();
  const meta = SKINS.find((s) => s.id === skin)!;

  const cycleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    const idx = SKINS.findIndex((s) => s.id === skin);
    setSkin(SKINS[(idx + 1) % SKINS.length].id, e);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycleNext}
      aria-label={`Current skin: ${meta.label}. Click to cycle.`}
      title={meta.label}
    >
      <span
        style={{
          background: `linear-gradient(135deg, ${meta.swatchPrimary}, ${meta.swatchAccent})`,
          boxShadow: `0 0 6px ${meta.swatchPrimary}55`,
        }}
        className="w-3.5 h-3.5 rounded-full"
      />
    </Button>
  );
}
