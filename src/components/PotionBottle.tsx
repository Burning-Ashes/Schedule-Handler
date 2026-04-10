import { useEffect, useState } from "react";

interface PotionBottleProps {
  value: number; // 0-100
}

const PotionBottle = ({ value }: PotionBottleProps) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timeout);
  }, [value]);

  // Bottle dimensions (pixel-art style)
  // The liquid fills from bottom up inside the bottle body
  // Body area: roughly y=100 to y=200 (100px tall)
  const liquidHeight = (animatedValue / 100) * 88;
  const liquidY = 192 - liquidHeight;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 120 220"
        width="120"
        height="220"
        className="drop-shadow-lg"
      >
        <defs>
          {/* Liquid gradient */}
          <linearGradient id="liquidGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(210, 80%, 55%)" />
            <stop offset="50%" stopColor="hsl(200, 85%, 60%)" />
            <stop offset="100%" stopColor="hsl(215, 75%, 50%)" />
          </linearGradient>

          {/* Shimmer animation */}
          <linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-1 0"
              to="1 0"
              dur="3s"
              repeatCount="indefinite"
            />
          </linearGradient>

          {/* Clip path for liquid inside bottle body */}
          <clipPath id="bottleBodyClip">
            {/* Main body */}
            <rect x="24" y="104" width="72" height="88" rx="4" />
            {/* Neck */}
            <rect x="42" y="68" width="36" height="40" />
          </clipPath>

          {/* Wave filter */}
          <filter id="wave">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015"
              numOctaves="2"
              seed="1"
            >
              <animate
                attributeName="baseFrequency"
                values="0.015;0.02;0.015"
                dur="4s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="4" />
          </filter>
        </defs>

        {/* === BOTTLE OUTLINE (pixel-art inspired) === */}

        {/* Cork / Stopper */}
        <rect x="40" y="36" width="40" height="24" rx="3" fill="hsl(15, 55%, 45%)" />
        <rect x="43" y="39" width="14" height="18" rx="2" fill="hsl(15, 50%, 55%)" opacity="0.6" />

        {/* Percentage on cork */}
        <text
          x="60"
          y="52"
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="hsl(15, 90%, 95%)"
          fontFamily="system-ui, sans-serif"
        >
          {animatedValue}%
        </text>

        {/* Cork rim */}
        <rect x="36" y="56" width="48" height="6" rx="2" fill="hsl(15, 45%, 38%)" />

        {/* Neck */}
        <rect x="42" y="62" width="36" height="42" rx="2" fill="hsl(0, 0%, 90%)" stroke="hsl(0,0%,78%)" strokeWidth="2" />
        {/* Neck highlight */}
        <rect x="46" y="64" width="8" height="36" rx="1" fill="hsl(0, 0%, 96%)" opacity="0.7" />

        {/* Body */}
        <rect x="24" y="104" width="72" height="88" rx="6" fill="hsl(0, 0%, 92%)" stroke="hsl(0,0%,78%)" strokeWidth="2" />

        {/* Body glass highlights */}
        <rect x="30" y="110" width="10" height="70" rx="3" fill="hsl(0, 0%, 98%)" opacity="0.6" />
        <rect x="44" y="110" width="4" height="50" rx="2" fill="hsl(0, 0%, 98%)" opacity="0.3" />

        {/* Shoulder connectors */}
        <polygon points="42,104 24,104 42,90" fill="hsl(0, 0%, 90%)" stroke="hsl(0,0%,78%)" strokeWidth="2" />
        <polygon points="78,104 96,104 78,90" fill="hsl(0, 0%, 90%)" stroke="hsl(0,0%,78%)" strokeWidth="2" />

        {/* === LIQUID === */}
        <g clipPath="url(#bottleBodyClip)">
          {/* Main liquid body */}
          <rect
            x="24"
            y={liquidY}
            width="72"
            height={liquidHeight + 4}
            fill="url(#liquidGrad)"
            style={{ transition: "y 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), height 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          />

          {/* Wave surface */}
          <ellipse
            cx="60"
            cy={liquidY}
            rx="36"
            ry="4"
            fill="hsl(200, 90%, 70%)"
            opacity="0.6"
            filter="url(#wave)"
            style={{ transition: "cy 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          />

          {/* Shimmer overlay */}
          <rect
            x="24"
            y={liquidY}
            width="72"
            height={liquidHeight + 4}
            fill="url(#shimmer)"
            style={{ transition: "y 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), height 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          />

          {/* Bubbles */}
          {animatedValue > 10 && (
            <>
              <circle cx="45" cy={liquidY + liquidHeight * 0.6} r="2.5" fill="hsl(200, 90%, 75%)" opacity="0.5">
                <animate attributeName="cy" values={`${liquidY + liquidHeight * 0.8};${liquidY + 5}`} dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="65" cy={liquidY + liquidHeight * 0.4} r="1.8" fill="hsl(200, 90%, 80%)" opacity="0.4">
                <animate attributeName="cy" values={`${liquidY + liquidHeight * 0.6};${liquidY + 3}`} dur="3.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0" dur="3.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="55" cy={liquidY + liquidHeight * 0.3} r="2" fill="hsl(195, 85%, 75%)" opacity="0.3">
                <animate attributeName="cy" values={`${liquidY + liquidHeight * 0.5};${liquidY + 8}`} dur="4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0" dur="4s" repeatCount="indefinite" />
              </circle>
            </>
          )}
        </g>

        {/* Base */}
        <rect x="20" y="192" width="80" height="8" rx="3" fill="hsl(0, 0%, 75%)" />
        <rect x="22" y="192" width="76" height="4" rx="2" fill="hsl(0, 0%, 82%)" />
      </svg>
    </div>
  );
};

export default PotionBottle;
