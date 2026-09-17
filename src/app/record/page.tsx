import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/ui/Footer";
import { KIND_LABEL, getFacets, isExternal, starsIn } from "@/components/ui/record-lookup";
import { record } from "@/content/record";
import type { SourceLink } from "@/lib/contract";

export const metadata: Metadata = {
  title: "The record",
  description: `Every verified line of ${record.owner.name}'s work, grouped by constellation, with a source for each.`,
  alternates: { canonical: "/record" },
  openGraph: {
    title: `The record · ${record.owner.name}`,
    description: `Every verified line of ${record.owner.name}'s work, with a source for each.`,
    url: "/record",
  },
};

function Evidence({ link }: { link: SourceLink }) {
  if (isExternal(link.url)) {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer">
        {link.label}
        <span className="arrow" aria-hidden="true">
          ↗
        </span>
      </a>
    );
  }
  return <a href={link.url}>{link.label}</a>;
}

// Server-rendered, no client JavaScript. This page serves reduced-motion
// visitors, devices without WebGL, crawlers, and anyone who wants the list.
export default function RecordPage() {
  const { owner, constellations, stars, facets } = record;
  const groups = constellations
    .map((c) => ({ ...c, stars: starsIn(c.id) }))
    .filter((c) => c.stars.length > 0);

  return (
    <main className="record" id="main">
      <header className="record-head">
        <Link href="/" className="record-back">
          <span aria-hidden="true">←</span> Back to the star map
        </Link>
        <h1 className="display record-title">The record</h1>
        <p className="record-lede">
          {owner.name}, {owner.role}. {owner.tagline}
        </p>
        <p className="record-stats">
          <span>{stars.length} stars</span>
          <span>{facets.length} lines</span>
          <span>{groups.length} constellations</span>
          <a href="/record.json">record.json</a>
          <a href="/llms.txt">llms.txt</a>
        </p>
        <nav className="record-nav" aria-label="Constellations">
          {groups.map((c) => (
            <a key={c.id} href={`#${c.id}`}>
              {c.label}
              <span className="n">{c.stars.length}</span>
            </a>
          ))}
        </nav>
      </header>

      {groups.map((c) => (
        <section key={c.id} id={c.id} className="constellation" aria-labelledby={`h-${c.id}`}>
          <div className="constellation-head">
            <h2 id={`h-${c.id}`} className="display-small">
              {c.label}
            </h2>
            <span className="count">
              {c.stars.length} {c.stars.length === 1 ? "star" : "stars"}
            </span>
          </div>
          {c.stars.map((star) => {
            const lines = getFacets(star.id);
            const meta = [KIND_LABEL[star.kind], star.period].filter(Boolean).join(" · ");
            return (
              <article key={star.id} id={star.id} className="star" aria-labelledby={`h-${star.id}`}>
                <div className="star-head">
                  <h3 id={`h-${star.id}`} className="display-small">
                    <a href={`#${star.id}`}>{star.label}</a>
                  </h3>
                  <span className="star-meta">
                    {meta} · <span className="star-id">{star.id}</span>
                  </span>
                </div>
                <p className="star-summary">{star.summary}</p>
                {lines.length > 0 && (
                  <ul className="star-facets">
                    {lines.map((facet) => (
                      <li key={facet.id} id={facet.id}>
                        {facet.text}
                        {facet.source && (
                          <a href={facet.source.url} target="_blank" rel="noopener noreferrer">
                            {facet.source.label} ↗
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {star.links.length > 0 && (
                  <div className="evidence star-links" aria-label={`Sources for ${star.label}`}>
                    {star.links.map((link) => (
                      <Evidence key={link.url} link={link} />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}

      <div className="record-foot">
        <Footer />
      </div>
    </main>
  );
}
