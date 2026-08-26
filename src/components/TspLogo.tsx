import React from 'react';

interface TspLogoProps {
  className?: string;
  size?: number;
}

export const TspLogo: React.FC<TspLogoProps> = ({ className = '', size = 52 }) => {
  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Circular path for top curved text */}
          <path
            id="tspLogoTextArc"
            d="M 28 108 A 72 72 0 0 1 172 108"
            fill="none"
          />
        </defs>

        {/* Outer White Background Circle */}
        <circle cx="100" cy="100" r="96" fill="#ffffff" />

        {/* Outer Green Ring */}
        <circle cx="100" cy="100" r="93" stroke="#006837" strokeWidth="5.5" fill="none" />

        {/* Inner Green Border for Upper Arc */}
        <path
          d="M 25 110 A 75 75 0 0 1 175 110"
          stroke="#006837"
          strokeWidth="3.5"
          fill="none"
        />

        {/* Curved Top Brand Text */}
        <text fontFamily="'Arial Black', 'Impact', 'Trebuchet MS', sans-serif" fontSize="16.5" fontWeight="900" fill="#000000" letterSpacing="1.2">
          <textPath href="#tspLogoTextArc" startOffset="50%" textAnchor="middle">
            TSP COMPLEX LTD.
          </textPath>
        </text>

        {/* Left Laurel / Wheat Sprigs */}
        <g fill="#006837" stroke="#006837" strokeWidth="0.5">
          <path d="M 22 84 Q 28 80 34 85 Q 27 89 22 84 Z" />
          <path d="M 26 73 Q 32 68 38 74 Q 31 78 26 73 Z" />
          <path d="M 33 63 Q 39 58 45 64 Q 38 68 33 63 Z" />
          <path d="M 20 95 Q 26 92 32 97 Q 25 101 20 95 Z" />
          <path d="M 29 104 Q 34 98 40 103 Q 35 108 29 104 Z" />
          <path d="M 35 90 Q 40 84 46 89 Q 41 95 35 90 Z" />
          <path d="M 40 77 Q 45 71 51 77 Q 46 82 40 77 Z" />
        </g>

        {/* Right Laurel / Wheat Sprigs */}
        <g fill="#006837" stroke="#006837" strokeWidth="0.5">
          <path d="M 178 84 Q 172 80 166 85 Q 173 89 178 84 Z" />
          <path d="M 174 73 Q 168 68 162 74 Q 169 78 174 73 Z" />
          <path d="M 167 63 Q 161 58 155 64 Q 162 68 167 63 Z" />
          <path d="M 180 95 Q 174 92 168 97 Q 175 101 180 95 Z" />
          <path d="M 171 104 Q 166 98 160 103 Q 165 108 171 104 Z" />
          <path d="M 165 90 Q 160 84 154 89 Q 159 95 165 90 Z" />
          <path d="M 160 77 Q 155 71 149 77 Q 154 82 160 77 Z" />
        </g>

        {/* Bottom Half Industrial Gear (Heavy Black Cog with Green Trim) */}
        <path
          d="M 14 110 
             L 34 110 
             L 34 126 
             L 48 126 
             L 53 148 
             L 67 142 
             L 77 163 
             L 92 155 
             L 100 178 
             L 108 178 
             L 116 155 
             L 131 163 
             L 141 142 
             L 155 148 
             L 160 126 
             L 174 126 
             L 174 110 
             L 194 110 
             A 95 95 0 0 1 6 110 
             Z"
          fill="#0f172a"
          stroke="#006837"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Inner Gear Outline Rim */}
        <path
          d="M 38 120 A 68 68 0 0 0 162 120"
          stroke="#006837"
          strokeWidth="3.5"
          fill="none"
        />

        {/* Center Inner Circle: Field & Seedling Plant */}
        <circle cx="100" cy="98" r="54" fill="#ffffff" stroke="#006837" strokeWidth="4" />
        
        {/* Dark Green Ground in lower half of inner circle */}
        <path
          d="M 47 114 A 54 54 0 0 0 153 114 L 47 114 Z"
          fill="#006837"
        />

        {/* Plant Seedling Stem (Vertical White/Green Dividing Stem) */}
        <rect x="97" y="52" width="6" height="64" fill="#006837" />
        <line x1="100" y1="52" x2="100" y2="114" stroke="#ffffff" strokeWidth="3.5" />

        {/* Central Vertical Leaf */}
        <path
          d="M 100 38 C 91 55 91 76 100 86 C 109 76 109 55 100 38 Z"
          fill="#006837"
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        {/* Left Curved Sprouting Leaf */}
        <path
          d="M 100 78 C 82 66 58 70 50 86 C 68 94 92 88 100 78 Z"
          fill="#006837"
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        {/* Right Curved Sprouting Leaf */}
        <path
          d="M 100 78 C 118 66 142 70 150 86 C 132 94 108 88 100 78 Z"
          fill="#006837"
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        {/* Ground Divider Line */}
        <line x1="47" y1="114" x2="153" y2="114" stroke="#ffffff" strokeWidth="3" />
      </svg>
    </div>
  );
};
