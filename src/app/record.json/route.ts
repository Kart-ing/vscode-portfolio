// GET /record.json: the verified record as JSON, for agents and crawlers.

import { record } from "@/content/record";

export function GET(): Response {
  return Response.json(record, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
