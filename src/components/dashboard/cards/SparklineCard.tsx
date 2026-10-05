import React from 'react';

export interface SparklineCardProps {
  label: string;
  value: number;
  totalProjects?: number;
  sub: string;
  icon: React.ReactNode;
  onClick?: () => void;
  delay?: number;
  valueColor?: string;
}

// Helper to generate clear, intuitive sparkline paths that reflect the exact status count and rate
function getSparklineData(value: number, total: number = 0) {
  if (value === 0) {
    return {
      linePath: '',
      areaPath: '',
      dots: [],
    };
  }

  // Calculate percentage of total to scale height
  const pct = total > 0 ? Math.min(1, value / total) : 1;
  // Peak Y: higher percentage = reaches closer to top (y = 6 to y = 22)
  const peakY = Math.max(5, 26 - Math.round(pct * 21));
  const midY = Math.round((28 + peakY) / 2);

  return {
    linePath: `M 2 28 C 24 28, 44 ${midY + 2}, 64 ${midY - 2} S 84 ${peakY + 2}, 98 ${peakY}`,
    areaPath: `M 2 28 C 24 28, 44 ${midY + 2}, 64 ${midY - 2} S 84 ${peakY + 2}, 98 ${peakY} L 98 32 L 2 32 Z`,
    dots: [
      { cx: 64, cy: midY - 2 },
      { cx: 98, cy: peakY },
    ],
  };
}

export default function SparklineCard({
  label,
  value,
  totalProjects = 0,
  sub,
  icon,
  onClick,
  delay = 0,
  valueColor,
}: SparklineCardProps) {
  const color = valueColor || '#2563EB';
  const total = totalProjects > 0 ? totalProjects : Math.max(1, value);
  const percentage = totalProjects > 0 ? Math.round((value / totalProjects) * 100) : (value > 0 ? 100 : 0);

  const badgeText = label === 'PROJECTS'
    ? `${value} Total`
    : label === 'COMPLETED'
    ? `${percentage}% Done`
    : label === 'PENDING'
    ? `${percentage}% Queue`
    : `${percentage}% Active`;

  const { linePath, areaPath, dots } = getSparklineData(value, total);
  const gradId = `spark-grad-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${value}`;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#131B2E] rounded-3xl p-5 sm:p-6 border border-blue-100/70 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500/50 hover:-translate-y-1 cursor-pointer flex flex-col justify-between min-h-[145px] group animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle top gradient accent on hover matching status color */}
      <div
        className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, ${color} 0%, #3B82F6 100%)`,
        }}
      />

      {/* Top row: Label (Left) & Icon (Top-Right) */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider transition-colors duration-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 group-hover:bg-blue-600 group-hover:text-white shadow-2xs"
        >
          {icon}
        </div>
      </div>

      {/* Bottom row: Value & Subtitle (Left) + Context Badge & Trend Curve (Bottom-Right) */}
      <div className="flex items-end justify-between gap-4 mt-auto">
        <div className="min-w-0">
          <p
            className="text-3xl sm:text-4xl font-black leading-none mb-1 transition-transform duration-200 group-hover:scale-105 origin-left animate-count"
            style={{ color }}
          >
            {value}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
            {sub}
          </p>
        </div>

        {/* Bottom-right: Badge & Sparkline Graph */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Percentage Pill Badge */}
          <span
            className="text-[9px] font-bold px-1  py-0.5 rounded-full uppercase tracking-wider transition-all duration-200"
            style={{
              backgroundColor: value === 0 ? '#F1F5F9' : `${color}15`,
              color: value === 0 ? '#94A3B8' : color,
              border: `1px solid ${value === 0 ? '#E2E8F0' : `${color}30`}`,
            }}
          >
            {badgeText}
          </span>

          {/* SVG Sparkline (Rendered only when value > 0) */}
          {value > 0 && (
            <div className="w-24 sm:w-28 h-8 transition-all duration-300 group-hover:scale-105">
              <svg viewBox="0 0 100 35" fill="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Area fill under curve */}
                <path
                  d={areaPath}
                  fill={`url(#${gradId})`}
                  className="transition-all duration-700"
                />

                {/* Dynamic Line Graph */}
                <path
                  d={linePath}
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-wave-draw transition-all duration-700"
                />

                {/* Indicator Data Points */}
                {dots.map((d, i) => (
                  <circle
                    key={i}
                    cx={d.cx}
                    cy={d.cy}
                    r="3"
                    fill={color}
                    className="transition-all duration-700"
                    style={{
                      filter: `drop-shadow(0 0 3px ${color}80)`,
                    }}
                  />
                ))}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
