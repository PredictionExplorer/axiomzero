import { NextRequest } from "next/server";

import {
  getMarketplaceOffers,
  getMarketplaceStats,
  parseMarketplaceSearchParams,
} from "@/lib/marketplace/queries";

export const revalidate = 60;

function searchParamsToRecord(searchParams: URLSearchParams) {
  const params: Record<string, string | string[]> = {};

  for (const [key, value] of searchParams.entries()) {
    const current = params[key];
    if (Array.isArray(current)) {
      current.push(value);
    } else if (current !== undefined) {
      params[key] = [current, value];
    } else {
      params[key] = value;
    }
  }

  return params;
}

export async function GET(request: NextRequest) {
  try {
    const search = parseMarketplaceSearchParams(
      searchParamsToRecord(request.nextUrl.searchParams),
    );
    const offers = await getMarketplaceOffers(search);

    return Response.json({
      generatedAt: new Date().toISOString(),
      search,
      stats: getMarketplaceStats(offers),
      offers,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Marketplace offers could not be loaded.",
      },
      { status: 502 },
    );
  }
}
