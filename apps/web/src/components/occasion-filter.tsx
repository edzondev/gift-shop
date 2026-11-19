import { Link } from "@tanstack/react-router";
import type { Occasion } from "api";
import { OCCASIONS } from "../occasions";

const activeSearch = { exact: true, includeSearch: true } as const;

export function OccasionFilter({ active }: { active: Occasion | undefined }) {
  return (
    <nav className="occasion-filter" aria-label="Ocasión">
      <Link
        to="/catalogo"
        search={{ occasion: undefined }}
        activeOptions={activeSearch}
        className={active === undefined ? "chip chip-active" : "chip"}
      >
        Todos
      </Link>
      {OCCASIONS.map((item) => (
        <Link
          key={item.id}
          to="/catalogo"
          search={{ occasion: item.id }}
          activeOptions={activeSearch}
          className={active === item.id ? "chip chip-active" : "chip"}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
