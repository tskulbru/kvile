import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 24 }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={cn("flex-shrink-0", className)}
    >
      {/* Background */}
      <rect width="32" height="32" rx="6" fill="#020617" />
      {/* Reclined/tilted terminal prompt with zzz */}
      <g transform="rotate(-15 16 16)">
        <path
          d="M6 12L12 18L6 24"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="14"
          y1="22"
          x2="24"
          y2="22"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
      {/* Small zzz */}
      <path
        d="M22 6h4l-4 4h4"
        stroke="#22d3ee"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
