/* eslint-disable @next/next/no-img-element -- organiser photos are arbitrary remote URLs */
import { eventPhotos, type Theme } from "@/lib/theme";
import { PageDiscs } from "./bloom";

/** Repeats the photos until there are `count` of them, so short galleries still fill a layout. */
function fill(photos: string[], count: number) {
  return Array.from({ length: count }, (_, i) => photos[i % photos.length]);
}

// Corners and edges only, so the centred content column stays clear. The last two only show on wider screens.
const POLAROID_SLOTS = [
  "-top-4 -left-10 w-36 -rotate-6 sm:top-10 sm:left-[4%] sm:w-48",
  "top-[38%] -right-14 w-36 rotate-6 sm:top-16 sm:right-[5%] sm:w-52",
  "-bottom-6 -left-12 w-36 rotate-3 sm:bottom-12 sm:left-[7%] sm:w-44",
  "hidden sm:block bottom-8 right-[6%] w-48 -rotate-3",
  "hidden lg:block top-[44%] left-[2%] w-40 rotate-2",
];

/**
 * Full-page decorative layer behind the guest pages, in the style the organiser picked. A paper-coloured
 * scrim over every photo style keeps text readable in both the Daylight and Candlelight palettes.
 */
export function Backdrop({ theme }: { theme: Theme }) {
  const photos = eventPhotos(theme);
  if (theme.backdrop === "discs" || photos.length === 0) return <PageDiscs />;

  let layer: React.ReactNode;
  switch (theme.backdrop) {
    case "fullbleed":
      layer = (
        <>
          <img src={photos[0]} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-b from-paper/55 via-paper/85 to-paper/95" />
        </>
      );
      break;
    case "blurred":
      layer = (
        <>
          <img src={photos[0]} alt="" className="absolute inset-0 size-full scale-125 object-cover blur-2xl saturate-150" />
          <div className="absolute inset-0 bg-paper/65" />
        </>
      );
      break;
    case "collage":
      layer = (
        <>
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-1 sm:grid-cols-3 sm:grid-rows-2">
            {fill(photos, 6).map((src, i) => (
              <img key={i} src={src} alt="" className="size-full object-cover" />
            ))}
          </div>
          <div className="absolute inset-0 bg-paper/80" />
        </>
      );
      break;
    case "polaroids":
      layer = (
        <>
          <PageDiscs />
          {fill(photos, POLAROID_SLOTS.length).map((src, i) => (
            <figure key={i} className={`absolute m-0 bg-paper-raised p-2 pb-7 opacity-90 shadow-card ${POLAROID_SLOTS[i]}`}>
              <img src={src} alt="" className="aspect-square w-full object-cover" />
            </figure>
          ))}
        </>
      );
      break;
  }

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden print:hidden">
      {layer}
    </div>
  );
}

const STRIP_TILTS = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3", "-rotate-2", "rotate-1"];

/** Polaroid-style gallery of the event's photos for the event landing page. */
export function PhotoStrip({ photos, title }: { photos: string[]; title: string }) {
  if (photos.length === 0) return null;
  return (
    <section aria-label={`Photos of ${title}`} className="flex flex-wrap justify-center gap-4 px-2">
      {photos.slice(0, 6).map((src, i) => (
        <figure
          key={src}
          className={`m-0 w-[42%] bg-paper-raised p-2 pb-6 shadow-card transition hover:z-10 hover:rotate-0 hover:scale-105 sm:w-40 ${STRIP_TILTS[i % STRIP_TILTS.length]}`}
        >
          <img src={src} alt={`${title}, photo ${i + 1}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
        </figure>
      ))}
    </section>
  );
}
