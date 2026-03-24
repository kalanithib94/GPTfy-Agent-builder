import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type SfSessionData = {
  accessToken?: string;
  refreshToken?: string;
  instanceUrl?: string;
  idUrl?: string;
  userId?: string;
  orgId?: string;
  username?: string;
  /** Resolved GPTfy object/field namespace, e.g. '' | 'ccai__' | 'ccai_qa__' */
  gptfyNamespace?: string;
  /** login | test for token refresh */
  sfEnv?: "production" | "sandbox";
  /** Optional per-session External Client App override (for multi-org setups). */
  sfClientId?: string;
  sfClientSecret?: string;
  sfCallbackUrl?: string;
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "DEV_ONLY_CHANGE_ME_MIN_32_CHARS_LONG!!",
  cookieName: "gptfy_agent_gen",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  },
};

export async function getSfSession() {
  return getIronSession<SfSessionData>(await cookies(), sessionOptions);
}
