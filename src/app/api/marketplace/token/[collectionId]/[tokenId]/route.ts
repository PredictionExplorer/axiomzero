import { NextRequest } from "next/server";

import { getCollection } from "@/config/collections";
import { getTokenMarket } from "@/lib/marketplace/queries";
import type { CollectionId } from "@/lib/marketplace/types";

export const revalidate = 60;

type RouteContext = {
  params: Promise<{
    collectionId: string;
    tokenId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { collectionId, tokenId } = await context.params;
    const parsedTokenId = Number(tokenId);

    const collection = getCollection(collectionId as CollectionId);

    if (!collection || !Number.isInteger(parsedTokenId)) {
      return Response.json(
        { error: "Token market was not found." },
        { status: 404 },
      );
    }

    const market = await getTokenMarket(collection.id, parsedTokenId);

    return Response.json({
      generatedAt: new Date().toISOString(),
      collectionId: collection.id,
      tokenId: parsedTokenId,
      ...market,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Token market could not be loaded.",
      },
      { status: 502 },
    );
  }
}
