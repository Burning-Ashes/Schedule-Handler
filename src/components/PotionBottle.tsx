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

  // Pixel-art Bottle Dimensions
  // The liquid fills from bottom up inside the bottle body
  // Inner area: y=40 to y=190 (150px tall)
  const maximumHeight = 150;
  // Calculate based on the full interior height so it reaches the top
  const liquidHeight = (animatedValue / 100) * maximumHeight;
  const liquidY = 190 - liquidHeight;

  // Exact coordinates matching the pixel art image structure
  const outerPoints = "30,40 30,60 40,60 40,80 30,80 30,90 20,90 20,110 10,110 10,180 20,180 20,190 30,190 30,200 90,200 90,190 100,190 100,180 110,180 110,110 100,110 100,90 90,90 90,80 80,80 80,60 90,60 90,40";
  const innerPoints = "40,40 40,60 50,60 50,80 40,80 40,90 30,90 30,110 20,110 20,180 30,180 30,190 90,190 90,180 100,180 100,110 90,110 90,90 80,90 80,80 70,80 70,60 80,60 80,40";

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
            <polygon points={innerPoints} />
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

        {/* === CORK === */}
        {/* Top brown layer */}
        <rect x="40" y="10" width="40" height="10" fill="#B25E35" />
        {/* Light middle band (seal) */}
        <rect x="30" y="20" width="60" height="10" fill="#E6DFDD" />
        {/* Bottom brown layer */}
        <rect x="40" y="30" width="40" height="10" fill="#91411D" />

        {/* === BOTTLE OUTLINE AND GLASS === */}
        {/* Outer outline grey color */}
        <polygon points={outerPoints} fill="#C4C4C4" />
        
        {/* Inner bottle outline / thicker glass effect */}
        <polygon points={innerPoints} fill="#E0E0E0" />
        
        {/* Empty space inside where liquid goes */}
        <polygon points={innerPoints} fill="#F8F8F8" opacity="0.6" />

        {/* === LIQUID === */}
        <g clipPath="url(#bottleBodyClip)">
          {/* Main liquid body */}
          <rect
            x="0"
            y={liquidY}
            width="120"
            height="200"
            fill="url(#liquidGrad)"
            style={{ transition: "y 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), height 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          />

          {/* Wave surface */}
          <ellipse
            cx="60"
            cy={liquidY}
            rx="50"
            ry="4"
            fill="hsl(200, 90%, 70%)"
            opacity="0.6"
            filter="url(#wave)"
            style={{ transition: "cy 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
          />

          {/* Shimmer overlay */}
          <rect
            x="0"
            y={liquidY}
            width="120"
            height="200"
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

        {/* === INNER GLASS HIGHLIGHTS === */}
        {/* Adds to the pixel art shiny glass look */}
        <rect x="30" y="110" width="10" height="60" fill="#FFFFFF" opacity="0.7" />
        <rect x="40" y="100" width="10" height="10" fill="#FFFFFF" opacity="0.7" />
        <rect x="50" y="70" width="10" height="20" fill="#FFFFFF" opacity="0.6" />

        {/* Percentage text centered on the cork seal */}
        <text
          x="60"
          y="29"
          textAnchor="middle"
          fontSize="11"
          fontWeight="bold"
          fill="#4A2511"
          fontFamily="system-ui, sans-serif"
        >
          {animatedValue}%
        </text>
      </svg>
    </div>
  );
};

export default PotionBottle;
