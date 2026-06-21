import React from 'react';

interface MovieClubLogoProps {
  className?: string; // Target size e.g. "h-12 w-12" or "h-40 w-40"
  showText?: boolean;
  lightVariant?: boolean;
}

export default function MovieClubLogo({ 
  className = "h-12 w-12", 
  showText = false,
  lightVariant = false
}: MovieClubLogoProps) {
  const textColor = lightVariant ? "text-zinc-950" : "text-amber-500";
  const subTextColor = lightVariant ? "text-zinc-600" : "text-zinc-400 font-mono";

  return (
    <div className={`flex flex-col items-center justify-center ${showText ? 'space-y-4' : ''}`}>
      {/* Visual SVG Brand Icon */}
      <svg
        viewBox="0 0 200 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        id="iiser-movie-club-svg-logo"
      >
        {/* Shadow/Glow effect behind elements */}
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="80" r="75" fill="url(#glow)" />

        {/* --- POPCORN BUCKET (Left Side) --- */}
        <g id="popcorn-bucket">
          {/* Fluffy Popcorn overflowing at top (overlapping circles with shades) */}
          <g id="popcorn-fluff">
            {/* Back layer popcorn */}
            <circle cx="58" cy="42" r="9" fill="#D2A45C" />
            <circle cx="73" cy="38" r="10" fill="#EAD196" />
            <circle cx="88" cy="44" r="8" fill="#D2A45C" />
            
            {/* Mid layer popcorn */}
            <circle cx="65" cy="35" r="11" fill="#EAD196" />
            <circle cx="81" cy="32" r="12" fill="#F3E5AB" />
            <circle cx="94" cy="38" r="10" fill="#E6C875" />
            <circle cx="51" cy="48" r="9" fill="#E6C875" />

            {/* Front bright popcorn highlights */}
            <circle cx="59" cy="32" r="10" fill="#FFFBE6" />
            <circle cx="73" cy="27" r="11" fill="#FFFFFF" />
            <circle cx="87" cy="29" r="10" fill="#FFFBE6" />
            <circle cx="68" cy="23" r="8" fill="#FFFFFF" />
            <circle cx="80" cy="21" r="7" fill="#FFFFFF" />

            {/* Little bits of spilled popcorn on side */}
            <circle cx="40" cy="100" r="5" fill="#FFFBE6" />
            <circle cx="43" cy="101" r="4" fill="#EAD196" />
            <circle cx="46" cy="103" r="5" fill="#FFFFFF" />
            
            <circle cx="112" cy="103" r="5" fill="#FFFBE6" />
            <circle cx="107" cy="104" r="4" fill="#EAD196" />
            <circle cx="115" cy="105" r="5" fill="#FFFFFF" />
          </g>

          {/* Bucket Structure */}
          {/* White Base body of bucket (tapered trapezoid) */}
          <path 
            d="M 52,45 L 61,100 L 91,100 L 100,45 Z" 
            fill="#FFFFFF" 
            stroke="#18181B" 
            strokeWidth="2.5" 
            strokeLinejoin="round" 
          />

          {/* Red Stripes (Using paths over white base) */}
          <path d="M 58,45 L 65,100 L 70,100 L 64,45 Z" fill="#C52328" />
          <path d="M 72,45 L 75,100 L 79,100 L 78,45 Z" fill="#C52328" />
          <path d="M 85,45 L 87,100 L 91,100 L 93,45 Z" fill="#C52328" />

          {/* Golden Retro Emblem Badges on Popcorn Bucket */}
          {/* Badge 1 (Left) */}
          <circle cx="68" cy="72" r="8" fill="#C52328" stroke="#EAD196" strokeWidth="1" />
          <text x="68" y="75" fill="#EAD196" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="serif">S</text>
          
          {/* Badge 2 (Right) */}
          <circle cx="84" cy="72" r="8" fill="#C52328" stroke="#EAD196" strokeWidth="1" />
          <text x="84" y="75" fill="#EAD196" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="serif">&</text>
        </g>

        {/* --- CLAPPERBOARD (Right Side) --- */}
        <g id="clapperboard" transform="translate(10, 0)">
          {/* Open Clapstick (Upper moveable arm, tilted up slightly representing the active motion logo) */}
          <g id="upper-arm" transform="rotate(-26, 92, 54)">
            {/* Clapperboard arm black body */}
            <path 
              d="M 92,44 L 165,44 L 165,54 L 92,54 Z" 
              fill="#1A1A1A" 
              stroke="#000000" 
              strokeWidth="1.5"
            />
            {/* White diagonal stripes on the arm */}
            <path d="M 103,44 L 111,44 L 100,54 L 92,54 Z" fill="#FFFFFF" />
            <path d="M 121,44 L 129,44 L 118,54 L 110,54 Z" fill="#FFFFFF" />
            <path d="M 139,44 L 147,44 L 136,54 L 128,54 Z" fill="#FFFFFF" />
            <path d="M 157,44 L 165,44 L 154,54 L 146,54 Z" fill="#FFFFFF" />
          </g>

          {/* Lower Base Board */}
          <g id="board-base">
            {/* Hinge Link */}
            <circle cx="92" cy="59" r="3.5" fill="#4B5563" stroke="#000000" strokeWidth="1" />

            {/* Upper static rim bar */}
            <path 
              d="M 92,54 L 165,54 L 165,64 L 92,64 Z" 
              fill="#1A1A1A" 
              stroke="#000000" 
              strokeWidth="1.5"
            />
            {/* Matching static white diagonal stripes */}
            <path d="M 104,54 L 112,54 L 101,64 L 93,64 Z" fill="#FFFFFF" />
            <path d="M 122,54 L 130,54 L 119,64 L 111,64 Z" fill="#FFFFFF" />
            <path d="M 140,54 L 148,54 L 137,64 L 129,64 Z" fill="#FFFFFF" />
            <path d="M 158,54 L 166,54 L 155,64 L 147,64 Z" fill="#FFFFFF" />

            {/* Main chalk board body */}
            <path 
              d="M 92,64 L 165,64 L 165,103 L 92,103 Z" 
              fill="#111111" 
              stroke="#000000" 
              strokeWidth="2" 
              strokeLinejoin="round" 
            />

            {/* Text labels on board (Hollywood, Prod, Dir, Scene settings) */}
            <text x="97" y="73" fill="#D4D4D8" fontSize="5.5" fontWeight="bold" fontFamily="monospace" letterSpacing="0.5">HOLLYWOOD</text>
            <text x="97" y="80" fill="#A1A1AA" fontSize="4.5" fontFamily="monospace">PRODUCTION </text>
            <line x1="125" y1="79" x2="160" y2="79" stroke="#52525B" strokeWidth="0.8" />
            
            <text x="97" y="86" fill="#A1A1AA" fontSize="4.5" fontFamily="monospace">DIRECTOR</text>
            <line x1="121" y1="85" x2="160" y2="85" stroke="#52525B" strokeWidth="0.8" />
            
            <text x="97" y="92" fill="#A1A1AA" fontSize="4.5" fontFamily="monospace">CAMERA</text>
            <line x1="117" y1="91" x2="160" y2="91" stroke="#52525B" strokeWidth="0.8" />

            {/* Footer metrics: DATE, SCENE, TAKE */}
            <text x="97" y="99" fill="#A1A1AA" fontSize="4" fontFamily="monospace">DATE</text>
            <text x="117" y="99" fill="#A1A1AA" fontSize="4" fontFamily="monospace">SCENE</text>
            <text x="142" y="99" fill="#A1A1AA" fontSize="4" fontFamily="monospace">TAKE</text>
          </g>
        </g>
      </svg>

      {/* Accompanying Branding Typography */}
      {showText && (
        <div className="text-center space-y-1">
          <h2 className={`font-serif text-2xl font-black tracking-wider uppercase ${textColor} drop-shadow-md`}>
            Movie Club
          </h2>
          <div className="flex items-center justify-center space-x-2">
            <span className="h-px w-6 bg-zinc-800" />
            <p className={`text-xs font-mono tracking-widest uppercase ${subTextColor}`}>
              IISER Kolkata
            </p>
            <span className="h-px w-6 bg-zinc-800" />
          </div>
        </div>
      )}
    </div>
  );
}
