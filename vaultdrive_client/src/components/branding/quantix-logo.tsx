interface QuantixLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Inline SVG logo for QuantiX Drive — indigo gradient "Q" mark.
 * Kept as an SVG so no asset file is required and colors can be themed.
 */
export default function QuantixLogo({
  className = "h-10",
  alt = "QuantiX Drive",
}: QuantixLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="quantix-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#quantix-grad)" />
      <circle
        cx="32"
        cy="32"
        r="16"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
      />
      <line
        x1="40"
        y1="40"
        x2="48"
        y2="48"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
