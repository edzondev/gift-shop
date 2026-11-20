function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 19.5 5.5 15.5 15 6a2.1 2.1 0 0 1 3 3l-9.5 9.5-4 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m13.5 7.5 3 3M19.5 14.5v4M17.5 16.5h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 9c0 3 2.5 5.5 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NOTES = [
  { label: "Hecho a pedido en 2 a 5 días", Icon: ClockIcon },
  { label: "Cada detalle, a tu gusto", Icon: PenIcon },
  { label: "Te acompaño por WhatsApp de principio a fin", Icon: ChatIcon },
] as const;

export function HomeMaker() {
  return (
    <section className="home-maker">
      <div className="home-maker-grid">
        <div className="home-maker-photo">
          <span className="home-maker-badge">Desde SJL, con cariño</span>
        </div>
        <div className="home-maker-copy">
          <span className="home-overline">Detrás de cada regalo</span>
          <blockquote>“Cada pieza la hago pensando en la persona que la va a recibir.”</blockquote>
          <p>
            Trabajo desde mi taller en San Juan de Lurigancho. Elijo los materiales uno por uno,
            armo cada regalo a mano y te escribo por WhatsApp para que llegue tal como lo
            imaginaste.
          </p>
          <ul>
            {NOTES.map((note) => (
              <li key={note.label}>
                <note.Icon />
                <span>{note.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
