import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql, credit, getUser } from '@/lib/db';
import { nftById, levelForHoldings } from '@/lib/config';
import { heldMoola } from '@/lib/state';
import { ownedSet } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Unlock an NFT: 'level' ones are claimed free once you reach the level,
 * 'mint' ones cost MOOLA. The freshly unlocked NFT becomes active.
 */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { id } = await req.json().catch(() => ({}));
  const def = nftById(id);
  if (!def) return badRequest('unknown NFT');

  const u = await getUser(ctx.user.id);
  if (!u) return unauthorized();

  const owned = ownedSet(u);
  if (owned.has(def.id)) return badRequest('already owned');

  if (def.unlock === 'starter') {
    // starter is always owned; nothing to do
    return badRequest('starter NFT');
  }

  if (def.unlock === 'level') {
    const level = levelForHoldings(heldMoola(u));
    if (level < (def.requiredLevel ?? 1)) return badRequest(`reach level ${def.requiredLevel} first`);
  } else if (def.unlock === 'mint') {
    const cost = def.costMoola ?? 0;
    if (u.balance < cost) return badRequest('not enough MOOLA');
    await credit(u.id, -cost, 'mint', `Minted ${def.name}`);
  }

  owned.add(def.id);
  await sql`
    UPDATE users SET owned_nfts = ${[...owned].join(',')}, active_nft = ${def.id}
    WHERE id = ${u.id};
  `;

  return userResponse(u.id, { unlocked: def.id });
}
