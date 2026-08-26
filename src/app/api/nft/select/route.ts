import { NextRequest } from 'next/server';
import { authed, unauthorized, badRequest, userResponse } from '@/lib/api';
import { sql, getUser } from '@/lib/db';
import { ownedSet } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Equip an owned NFT as the active miner skin. */
export async function POST(req: NextRequest) {
  const ctx = await authed(req);
  if (!ctx) return unauthorized();

  const { id } = await req.json().catch(() => ({}));
  const u = await getUser(ctx.user.id);
  if (!u) return unauthorized();
  if (!ownedSet(u).has(id)) return badRequest('you do not own this NFT');

  await sql`UPDATE users SET active_nft = ${id} WHERE id = ${u.id};`;
  return userResponse(u.id);
}
