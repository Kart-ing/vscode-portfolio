// GET /llms.txt: Markdown generated from the record, for agents and crawlers.

import { record } from "@/content/record";
import { renderLlmsTxt } from "@/lib/server/llms";
import { SITE_URL } from "@/lib/server/site";

export function GET(): Response {
  return new Response(renderLlmsTxt(record, SITE_URL), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
