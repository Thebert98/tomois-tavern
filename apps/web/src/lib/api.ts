"use client";

import { supabaseBrowser } from "./supabase/client";
import { env } from "./env";

async function authedFetch(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const sb = supabaseBrowser();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) {
    throw new Error("not signed in");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ---- workshop (Magic Mirror + Tavern Bard) ----
export interface PortraitDTO {
  id: string;
  character_id: string;
  image_url: string | null;
  sprite_url: string | null;
  is_current: boolean;
  prompt: string;
  status: string;
  created_at: string;
}

export const workshop = {
  async createPortrait(input: {
    character_id: string;
    prompt: string;
    aspect_ratio?: string;
  }) {
    const res = await authedFetch(env.workshopBaseUrl, "/portraits", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return asJson<PortraitDTO>(res);
  },
  async listPortraits(characterId?: string) {
    const qs = characterId
      ? `?character_id=${encodeURIComponent(characterId)}`
      : "";
    const res = await authedFetch(env.workshopBaseUrl, `/portraits${qs}`);
    return asJson<PortraitDTO[]>(res);
  },
  async setCurrentPortrait(id: string) {
    const res = await authedFetch(
      env.workshopBaseUrl,
      `/portraits/${id}/current`,
      { method: "PATCH" },
    );
    return asJson<PortraitDTO>(res);
  },
  async createSong(input: {
    scope: "feat" | "party" | "lore";
    source_id?: string | null;
    prompt: string;
    genre?: string;
  }) {
    const res = await authedFetch(env.workshopBaseUrl, "/songs", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return asJson<{
      id: string;
      audio_url: string | null;
      lyrics: string | null;
      status: string;
      duration_s: number | null;
      cost_usd: number | null;
    }>(res);
  },
};

// ---- reroll (existing service) ----
export const reroll = {
  async listCharacters() {
    const res = await authedFetch(env.rerollBaseUrl, "/characters");
    return asJson<
      Array<{
        id: string;
        name: string;
        sheet: Record<string, unknown>;
        updated_at: string;
      }>
    >(res);
  },
};
