import crypto from 'node:crypto';
import { env } from './config';

export type TgUser = {
  id: string;
  first_name: string;
  username?: string | null;
  photo_url?: string | null;
};

export type AuthResult = {
  user: TgUser;
  startParam: string | null; // referral payload
};

/**
 * Validate Telegram Web App initData per the official algorithm:
 *   secret = HMAC_SHA256(key="WebAppData", data=BOT_TOKEN)
 *   ok     = HMAC_SHA256(key=secret, data=data_check_string) === hash
 */
export function verifyInitData(initData: string): AuthResult | null {
  if (!initData) return env.ALLOW_DEV_AUTH ? devUser() : null;

  // Dev fallback — a plain JSON payload prefixed with "devmode:".
  if (env.ALLOW_DEV_AUTH && initData.startsWith('devmode:')) {
    try {
      const p = JSON.parse(initData.slice('devmode:'.length));
      return {
        user: {
          id: String(p.id ?? '1000001'),
          first_name: p.first_name ?? 'Dev Miner',
          username: p.username ?? 'dev_miner',
          photo_url: p.photo_url ?? null,
        },
        startParam: p.start_param ?? null,
      };
    } catch {
      return null;
    }
  }

  if (!env.BOT_TOKEN) return env.ALLOW_DEV_AUTH ? devUser() : null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;

  const authDate = Number(params.get('auth_date') ?? 0);
  if (authDate && Date.now() / 1000 - authDate > 60 * 60 * 24) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  const u = JSON.parse(userRaw);

  return {
    user: {
      id: String(u.id),
      first_name: u.first_name ?? 'Miner',
      username: u.username ?? null,
      photo_url: u.photo_url ?? null,
    },
    startParam: params.get('start_param') ?? null,
  };
}

function devUser(): AuthResult {
  return {
    user: { id: '1000001', first_name: 'Dev Miner', username: 'dev_miner', photo_url: null },
    startParam: null,
  };
}
