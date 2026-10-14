/**
 * The mark is a queue ticket, the universal sign of waiting. The ink "?" asks the question,
 * the chili dot is the waiting light, and the tear-off stub carries a clock.
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Wait? Kyu? logo">
      <g transform="rotate(-7 32 32)">
        <path d="M12 10H52a8 8 0 0 1 8 8V26a6 6 0 0 0 0 12V46a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8V38a6 6 0 0 0 0-12V18a8 8 0 0 1 8-8Z" fill="#ffc21a" />
        <path d="M39.5 15.5V48.5" stroke="#1a1a17" strokeOpacity=".35" strokeWidth="1.8" strokeDasharray="2.2 3.6" strokeLinecap="round" />
        <path d="M14.6 27.2a7.4 7.4 0 1 1 10.6 6.6c-2 1-3.1 2.2-3.1 4.4" fill="none" stroke="#1a1a17" strokeWidth="5" strokeLinecap="round" />
        <circle cx="22.2" cy="46.4" r="3.2" fill="#d9421c" />
        <circle cx="48.2" cy="32" r="4.8" fill="none" stroke="#1a1a17" strokeWidth="2.3" />
        <path d="M48.2 29.2V32l2 1.2" fill="none" stroke="#1a1a17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Mark + wordmark: “Wait? Kyu?”. Pass `light` on dark backgrounds. */
export default function Logo({ size = 38, light = false, tagline = false }: { size?: number; light?: boolean; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={`display text-[1.45rem] font-extrabold ${light ? "text-white" : "text-stone-900"}`}>
          Wait<span className="text-chili">?</span> Kyu<span className="text-chili">?</span>
        </span>
        {tagline && <span className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${light ? "text-stone-400" : "text-stone-500"}`}>Never wait blindly</span>}
      </span>
    </span>
  );
}
