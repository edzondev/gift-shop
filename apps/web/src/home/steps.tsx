function HeartIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 10.2c0 2.6 2 4.6 3.8 5.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1.6 2.2"
      />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 19.5 5.5 15.5 15 6a2.1 2.1 0 0 1 3 3l-9.5 9.5-4 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m13.5 7.5 3 3M19.5 14.5v4M17.5 16.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6.5" y="2.5" width="11" height="19" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.5 7h2v2h-2zM12.5 7h2v2h-2zM9.5 10h2v2h-2zM13.5 11.5h1M10.5 18h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrainIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="5.5"
        y="3"
        width="13"
        height="13.5"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5.5 10.5h13M9 13.6h.01M15 13.6h.01M8.5 20.5l2-4M15.5 20.5l-2-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Elige",
    body: "Explora regalos hechos a mano, uno por uno, en mi taller.",
    Icon: HeartIcon,
  },
  {
    n: "02",
    title: "Personaliza",
    body: "Un nombre, sus colores favoritos, una dedicatoria. Tú decides.",
    Icon: PenIcon,
  },
  {
    n: "03",
    title: "Yapea",
    body: "Paga con Yape y sube tu captura. Lo verificamos nosotros.",
    Icon: PhoneIcon,
  },
  {
    n: "04",
    title: "Recíbelo",
    body: "En una estación de la Línea 1 o en la puerta de tu casa.",
    Icon: TrainIcon,
  },
] as const;

export function HomeSteps() {
  return (
    <section className="home-steps" id="como">
      <div className="home-steps-head">
        <span className="home-kicker">Así de fácil</span>
        <h2>Cuatro pasos, cero estrés</h2>
      </div>
      <ol className="home-steps-grid">
        {STEPS.map((step) => (
          <li key={step.n}>
            <article className="home-step">
              <div className="home-step-top">
                <span className="home-step-icon">
                  <step.Icon />
                </span>
                <span className="home-step-n">{step.n}</span>
              </div>
              <div className="home-step-copy">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
