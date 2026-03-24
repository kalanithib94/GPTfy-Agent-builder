import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type AdminSessionData = {
  /** Epoch ms — admin UI allowed until this time */
  unlockedUntil?: number;
};

export const adminSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "DEV_ONLY_CHANGE_ME_MIN_32_CHARS_LONG!!",
  cookieName: "gptfy_admin_unlock",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  },
};

export async function getAdminSession() {
  return getIronSession<AdminSessionData>(await cookies(), adminSessionOptions);
}

export async function isAdminUnlocked(): Promise<boolean> {
  const s = await getAdminSession();
  const until = s.unlockedUntil;
  if (until == null || until <= Date.now()) return false;
  return true;
}

export function isAdminPasswordConfigured(): boolean {
  const p = process.env.GEN_ADMIN_SECRET?.trim();
  return Boolean(p && p.length >= 16);
}
