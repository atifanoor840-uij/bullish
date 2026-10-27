import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { stories, type Story } from "@/lib/site-data";
import { Pill, Reveal } from "./primitives";

/** Faux trading-desk backdrop used when a story has no thumbnail image yet. */
function DeskScene({ s, i }: { s: Story; i: number }) {
  const hues = ["from-amber-500/25", "from-sky-500/20", "from-orange-500/25", "from-emerald-500/20", "from-violet-500/20"];
  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${hues[i % hues.length]} via-card to-background`}>
      {/* Blurred monitor with a chart, behind the trader */}
      <div className="absolute top-6 right-5 h-24 w-36 rounded-md border border-white/10 bg-black/40 p-2 blur-[1.5px]">
        <svg viewBox="0 0 100 50" className="h-full w-full" preserveAspectRatio="none">
          <path d="M0 40 L12 34 L22 37 L34 24 L46 28 L58 15 L70 20 L82 8 L100 12" fill="none" stroke="var(--primary)" strokeWidth="2" />
          <path d="M0 40 L12 34 L22 37 L34 24 L46 28 L58 15 L70 20 L82 8 L100 12 V50 H0 Z" fill="var(--primary)" opacity="0.15" />
        </svg>
      </div>
      <div className="absolute top-10 left-6 h-16 w-10 rounded-sm bg-white/[0.04] blur-[1px]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card to-transparent" />
      {/* Trader silhouette */}
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col items-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-zinc-500 to-zinc-700 font-display text-2xl font-bold text-white/90 shadow-xl ring-4 ring-white/5">
          {s.name[0]}
        </span>
        <span className="-mt-2 h-16 w-40 rounded-t-[60px] bg-gradient-to-b from-zinc-600 to-zinc-800" />
      </div>
    </div>
  );
}

function StoryCard({ s, i, onPlay }: { s: Story; i: number; onPlay: () => void }) {
  return (
    <article className="group w-[290px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.08] bg-card transition duration-300 hover:-translate-y-1 hover:border-primary/40 sm:w-[340px]">
      <div className="relative h-56 overflow-hidden">
        {s.image ? (
          <img src={s.image} alt={s.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <DeskScene s={s} i={i} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
        <button
          onClick={onPlay}
          disabled={!s.video}
          aria-label={`Play ${s.name}'s story`}
          className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition group-hover:scale-110 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground enabled:cursor-pointer"
        >
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </button>
      </div>
      <div className="p-6 pt-3">
        <p className="flex items-center gap-2 text-sm text-foreground/80">
          {s.name}
          <img src={`https://flagcdn.com/w40/${s.country.toLowerCase()}.png`} alt={s.country} className="h-3 w-4 rounded-[2px] object-cover" />
        </p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold tracking-tight">{s.total}</span>
          <span className="text-sm text-muted-foreground">Total Rewards</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">“{s.quote}”</p>
      </div>
    </article>
  );
}

export function StoriesSection() {
  const track = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState<Story | null>(null);

  const slide = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 320) + 20), behavior: "smooth" });
  };

  return (
    <section id="stories" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Pill>Trader stories</Pill>
            <h2 className="text-silver mt-5 text-4xl font-semibold tracking-tight md:text-5xl">Real discipline. Real performance.</h2>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">Discover how disciplined traders pass evaluations and earn simulated performance payouts.</p>
          </div>
          <div className="flex gap-3">
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                onClick={() => slide(d)}
                aria-label={d === -1 ? "Previous" : "Next"}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-foreground transition hover:border-primary hover:text-primary"
              >
                {d === -1 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Full-bleed on the right, aligned with the container on the left */}
      <div
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4"
        style={{ paddingLeft: "max(1.25rem, calc((100vw - 80rem) / 2 + 1.25rem))", scrollPaddingLeft: "max(1.25rem, calc((100vw - 80rem) / 2 + 1.25rem))" }}
      >
        {stories.map((s, i) => (
          <StoryCard key={s.name} s={s} i={i} onPlay={() => setPlaying(s)} />
        ))}
        <span className="w-5 shrink-0" />
      </div>

      <AnimatePresence>
        {playing?.video && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPlaying(null)}
          >
            <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black" onClick={(e) => e.stopPropagation()}>
              <iframe src={playing.video} title={playing.name} allow="autoplay; encrypted-media; fullscreen" allowFullScreen className="h-full w-full" />
              <button onClick={() => setPlaying(null)} aria-label="Close" className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
