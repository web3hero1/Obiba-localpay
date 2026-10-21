import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

export function ObibaLogo({ size = 'md', showWordmark = true, className = '' }: LogoProps) {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-lg', dot: 'w-2 h-2' },
    md: { icon: 'w-9 h-9', text: 'text-2xl', dot: 'w-2.5 h-2.5' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl', dot: 'w-3 h-3' },
    xl: { icon: 'w-16 h-16', text: 'text-4xl', dot: 'w-4 h-4' },
  };

  const current = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Official Obiba Dual-Pill Icon */}
      <div className={`relative ${current.icon} flex items-center justify-center`}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Upper Diagonal Pill */}
          <rect
            x="25"
            y="12"
            width="55"
            height="26"
            rx="13"
            transform="rotate(-28 25 12)"
            fill="#0A84FF"
          />
          {/* Lower Diagonal Pill with Gradient/Accent */}
          <rect
            x="32"
            y="48"
            width="60"
            height="26"
            rx="13"
            transform="rotate(-28 32 48)"
            fill="url(#obiba_blue_grad)"
          />
          <defs>
            <linearGradient id="obiba_blue_grad" x1="32" y1="48" x2="92" y2="74" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0A84FF" />
              <stop offset="1" stopColor="#0066CC" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showWordmark && (
        <span className={`font-extrabold tracking-tight text-[#0B0B0C] ${current.text} font-sans`}>
          obiba
        </span>
      )}
    </div>
  );
}
