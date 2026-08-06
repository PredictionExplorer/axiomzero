import { fallback, http, type HttpTransportConfig } from "viem";

import { getArbitrumRpcUrlsInRotationOrder } from "@/lib/server-rotation";

/**
 * viem transport over the configured Arbitrum RPC servers: ordered by the
 * hourly rotation (see `server-rotation.ts`), with viem's `fallback()`
 * failing over to the next server when a request errors. Plain `http()` when
 * only one server is configured.
 */
export function getArbitrumRpcTransport(config?: HttpTransportConfig) {
  const urls = getArbitrumRpcUrlsInRotationOrder();
  if (urls.length === 1) {
    return http(urls[0], config);
  }
  return fallback(urls.map((url) => http(url, config)));
}
