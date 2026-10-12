/** Bloom & Vow primitives: botanical line art, the arched portrait, status pills and decorative discs. */

export function Flourish({ width = 160, className = "" }: { width?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 40"
      width={width}
      height={width / 5}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`mx-auto block text-cocoa ${className}`}
    >
      <path d="M20 22 C60 30 80 30 100 20 C120 30 140 30 180 22" />
      <path d="M86 12 L114 28 M114 12 L86 28" />
      <g className="fill-blush">
        <path d="M34 24 C30 16 36 10 44 12 C44 20 40 24 34 24 Z" />
        <path d="M52 28 C50 20 56 15 63 18 C62 25 58 28 52 28 Z" />
        <path d="M166 24 C170 16 164 10 156 12 C156 20 160 24 166 24 Z" />
        <path d="M148 28 C150 20 144 15 137 18 C138 25 142 28 148 28 Z" />
      </g>
      <circle cx={14} cy={21} r={2.5} stroke="none" className="fill-cocoa" />
      <circle cx={186} cy={21} r={2.5} stroke="none" className="fill-cocoa" />
    </svg>
  );
}

export function BloomStem({ width = 100, className = "" }: { width?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 200"
      width={width}
      height={(width * 200) / 120}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-cocoa ${className}`}
    >
      <path d="M60 196 C58 150 62 110 60 70" />
      <path d="M60 150 C40 140 30 120 34 100 C50 108 58 126 60 150 Z" className="fill-blush" />
      <path d="M60 124 C80 116 90 96 86 76 C70 84 62 102 60 124 Z" className="fill-blush" />
      <path d="M60 172 C76 168 88 156 90 140" />
      <circle cx={90} cy={138} r={4} stroke="none" className="fill-cocoa" />
      <path d="M60 70 C44 62 40 44 52 34 C56 46 60 52 60 70 Z" className="fill-petal" />
      <path d="M60 70 C76 62 80 44 68 34 C64 46 60 52 60 70 Z" className="fill-petal" />
      <path d="M60 70 C54 52 54 36 60 22 C66 36 66 52 60 70 Z" className="fill-blush" />
      <path d="M60 22 L60 12" />
      <circle cx={60} cy={9} r={3} stroke="none" className="fill-slate" />
    </svg>
  );
}

/** "Ama & Kwame" → "A & K"; "Acme Annual Gala" → "AA" */
export function initials(title: string) {
  const parts = title.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean);
  if (parts.length < 2) {
    const letters = title.split(/\s+/).map((w) => w.match(/\p{L}|\p{N}/u)?.[0]?.toUpperCase()).filter(Boolean);
    return letters.slice(0, 2).join("") || "♡";
  }
  return parts.map((p) => p.trim()[0]?.toUpperCase()).filter(Boolean).join(" & ") || "♡";
}

export function ArchFrame({ src, alt = "", initials: label, width = 220 }: { src?: string; alt?: string; initials: string; width?: number }) {
  const arch = "rounded-t-full rounded-b-md";
  return (
    <figure className={`relative z-10 m-0 inline-block border border-hairline bg-paper-raised p-2 ${arch}`} style={{ width }}>
      <div className={`relative grid aspect-[3/4] place-items-center overflow-hidden bg-petal ${arch}`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="size-full object-cover" />
        ) : (
          <>
            <span aria-hidden="true" className="absolute top-[22%] -left-[12%] aspect-square w-[70%] rounded-full bg-blush" />
            <span aria-hidden="true" className="absolute right-[12%] bottom-[14%] aspect-square w-[22%] rounded-full bg-slate" />
            <span role="img" aria-label={alt || "Initials"} className="relative font-script text-5xl leading-none text-ink">
              {label}
            </span>
          </>
        )}
      </div>
    </figure>
  );
}

type PillTone = "pending" | "attending" | "declined" | "stamp";
const pillTones: Record<PillTone, string> = {
  pending: "bg-paper-raised text-ink-muted before:bg-cocoa",
  attending: "bg-paper-raised text-sage-ink before:bg-sage",
  declined: "bg-paper-raised text-cocoa-ink before:bg-blush-deep",
  stamp:
    "-rotate-3 border-terracotta bg-terracotta text-xs font-semibold tracking-[0.14em] text-ink uppercase before:bg-current dark:text-paper",
};

export function Pill({ tone = "pending", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-[13px] leading-5 font-medium before:size-2 before:rounded-full ${pillTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Soft discs that bleed off the page edges. Purely decorative; sits behind content. */
export function PageDiscs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden print:hidden">
      <span className="absolute -top-24 -right-28 size-72 rounded-full bg-blush/60 sm:size-96" />
      <span className="absolute top-40 -right-6 size-16 rounded-full bg-petal sm:right-24" />
      <span className="absolute -bottom-32 -left-24 size-80 rounded-full bg-petal" />
      <span className="absolute bottom-24 left-14 size-6 rounded-full bg-terracotta/80" />
    </div>
  );
}
