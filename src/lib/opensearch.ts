import { Client } from "@opensearch-project/opensearch";
import { env } from "@/lib/env";

const globalForOpenSearch = globalThis as unknown as { opensearch?: Client };

export const EVENTS_INDEX = "events-v1";

export function getOpenSearch() {
  if (globalForOpenSearch.opensearch) return globalForOpenSearch.opensearch;
  if (!env.OPENSEARCH_NODE) return null;

  const client = new Client({
    node: env.OPENSEARCH_NODE,
    auth:
      env.OPENSEARCH_USERNAME && env.OPENSEARCH_PASSWORD
        ? { username: env.OPENSEARCH_USERNAME, password: env.OPENSEARCH_PASSWORD }
        : undefined,
  });

  if (process.env.NODE_ENV !== "production") globalForOpenSearch.opensearch = client;
  return client;
}

