const PHRASES = [
  ["Cumpleaños", "con cariño"],
  ["Aniversarios", "con historia"],
  ["San Valentín", "con intención"],
  ["Día de la Madre", "con gratitud"],
  ["Solo porque sí", "con alegría"],
] as const;

function MarqueeCopy({ hidden }: { hidden: boolean }) {
  return (
    <div className="marquee-copy" aria-hidden={hidden ? true : undefined}>
      {PHRASES.map(([title, accent]) => (
        <span className="marquee-group" key={title}>
          <span className="marquee-title">{title}</span>
          <span className="marquee-accent">{accent}</span>
          <span className="marquee-mark">✦</span>
        </span>
      ))}
    </div>
  );
}

export function HomeMarquee() {
  return (
    <section className="home-marquee" aria-label="Ocasiones">
      <div className="marquee-track">
        <MarqueeCopy hidden={false} />
        <MarqueeCopy hidden />
      </div>
    </section>
  );
}
