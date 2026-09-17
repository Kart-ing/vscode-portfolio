import Link from "next/link";

export const SOURCE_URL = "https://github.com/Kart-ing/vscode-portfolio";

export function Footer() {
  return (
    <p className="footer">
      <span className="wide">Every line links to its source.</span>
      <span className="sep wide" aria-hidden="true">
        ·
      </span>
      <span>Questions go to GLM-5.2 via OpenRouter.</span>
      <span className="sep" aria-hidden="true">
        ·
      </span>
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
        View source
      </a>
      <span className="sep" aria-hidden="true">
        ·
      </span>
      <a href="/llms.txt">/llms.txt</a>
      <span className="sep" aria-hidden="true">
        ·
      </span>
      <Link href="/record">/record</Link>
    </p>
  );
}
