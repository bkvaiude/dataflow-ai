interface LogoProps {
  className?: string;
}

export function Logo({ className = "w-5 h-5" }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
    >
      {/* 6 outer dots in hexagon pattern */}
      <circle cx="26" cy="16" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="21" cy="7.34" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="11" cy="7.34" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="6" cy="16" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="11" cy="24.66" r="3" fill="currentColor" opacity="0.8" />
      <circle cx="21" cy="24.66" r="3" fill="currentColor" opacity="0.8" />

      {/* Center bullseye - concentric rings */}
      <circle cx="16" cy="16" r="5" fill="currentColor" />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" opacity="0.5" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
      <circle cx="16" cy="16" r="0.8" fill="white" />
    </svg>
  );
}
