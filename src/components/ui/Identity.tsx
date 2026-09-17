import Link from "next/link";
import { record } from "@/content/record";
import { isExternal } from "./record-lookup";
import { TourButton } from "./TourButton";

// Server-rendered. This is what a 30-second reader, a crawler and a visitor
// with JavaScript off all get before anything else loads.
export function Identity() {
  const { owner } = record;
  return (
    <div className="identity">
      <h1 className="display identity-name">{owner.name}</h1>
      <p className="identity-role">{owner.role}</p>
      <div className="identity-more">
        <p className="identity-tagline">{owner.tagline}</p>
        <nav className="identity-links" aria-label="Links">
          {owner.links.map((link) =>
            isExternal(link.url) ? (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label} ↗
              </a>
            ) : (
              <a key={link.url} href={link.url}>
                {link.label}
              </a>
            ),
          )}
          <Link href="/record" className="to-record">
            Browse the full record →
          </Link>
          <TourButton />
        </nav>
      </div>
    </div>
  );
}
