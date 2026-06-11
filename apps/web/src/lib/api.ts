"use client";

import { supabaseBrowser } from "./supabase/client";
import { env } from "./env";

/**
 * Proactively refresh the Supabase session if its access_token is close
 * to expiry. Multi-step wizard submits (Fireplace `create→update→generate`,
 * LevelUp `update→generate`) used to strand partial state when the JWT
 * expired mid-sequence; calling this once before the first network step
 * eliminates that whole class of failure.
 *
 * The Supabase SDK auto-refreshes proactively too, but only on a timer —
 * a long-idle tab can still hit a request with a stale token.
 */
export async function ensureFreshSession(): Promise<void> {
  const sb = supabaseBrowser();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return; // not signed in — let the next call reject loudly
  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  // Refresh if we're within 60s of expiry. Conservative — refreshes are
  // cheap and idempotent at the SDK layer.
  if (expiresAt - nowSec < 60) {
    await sb.auth.refreshSession();
  }
}

async function authedFetch(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  _retried: boolean = false,
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
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  // One-shot recovery on 401: the token expired between getSession() and
  // the server reading it (rare but real). Refresh and retry exactly once.
  // Without this retry, a single stale request would stop a wizard mid-flow.
  if (res.status === 401 && !_retried) {
    const { data, error } = await sb.auth.refreshSession();
    if (!error && data.session) {
      return authedFetch(baseUrl, path, init, true);
    }
  }
  return res;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ---- workshop (Magic Mirror + Tavern Bard) ----
export type PortraitStage =
  | "queued"
  | "painting"
  | "ready"
  | "failed";

export interface PortraitDTO {
  id: string;
  character_id: string;
  image_url: string | null;
  is_current: boolean;
  prompt: string;
  status: string;
  stage: PortraitStage | null;
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
  async deletePortrait(id: string) {
    const res = await authedFetch(env.workshopBaseUrl, `/portraits/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${res.status}: ${detail}`);
    }
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
    return asJson<SongDTO>(res);
  },
  async listSongs() {
    const res = await authedFetch(env.workshopBaseUrl, "/songs");
    return asJson<SongDTO[]>(res);
  },
};

// ---- world lore ----
export interface LoreDTO {
  id: string;
  title: string;
  body: string;
  created_at: string | null;
}

export const lore = {
  async list(): Promise<LoreDTO[]> {
    const res = await authedFetch(env.workshopBaseUrl, "/lore");
    return asJson<LoreDTO[]>(res);
  },
  async create(input: { title: string; body: string }): Promise<LoreDTO> {
    const res = await authedFetch(env.workshopBaseUrl, "/lore", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return asJson<LoreDTO>(res);
  },
  async delete(id: string): Promise<void> {
    const res = await authedFetch(env.workshopBaseUrl, `/lore/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${res.status}: ${detail}`);
    }
  },
};

export interface SongDTO {
  id: string;
  scope: "feat" | "party" | "lore";
  source_id: string | null;
  prompt: string;
  lyrics: string | null;
  audio_url: string | null;
  status: string;
  duration_s: number | null;
  cost_usd: number | null;
  created_at: string;
}

// ---- friends ----
export interface FriendDTO {
  other_user_id: string;
  other_email: string | null;
  status: "pending" | "accepted" | "blocked";
  direction: "incoming" | "outgoing";
  created_at: string | null;
}

export const friends = {
  async list() {
    const res = await authedFetch(env.workshopBaseUrl, "/friends");
    return asJson<FriendDTO[]>(res);
  },
  async invite(email: string) {
    const res = await authedFetch(env.workshopBaseUrl, "/friends", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return asJson<FriendDTO>(res);
  },
  async accept(otherUserId: string) {
    const res = await authedFetch(
      env.workshopBaseUrl,
      `/friends/${otherUserId}/accept`,
      { method: "POST" },
    );
    return asJson<FriendDTO>(res);
  },
  async remove(otherUserId: string) {
    const res = await authedFetch(
      env.workshopBaseUrl,
      `/friends/${otherUserId}`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 204) {
      throw new Error(`${res.status}: ${await res.text()}`);
    }
  },
};

// ---- parties ----
export interface PartyDTO {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}
export interface PartyMemberDTO {
  party_id: string;
  user_id: string;
  character_id: string | null;
  role: string | null;
  email: string | null;
  /** The seated character's name, when one is assigned. Enriched server-side. */
  character_name: string | null;
  /** That character's active portrait, when one exists. */
  portrait_url: string | null;
}
export interface PartyDetailDTO extends PartyDTO {
  members: PartyMemberDTO[];
}

export const parties = {
  async list() {
    const res = await authedFetch(env.workshopBaseUrl, "/parties");
    return asJson<PartyDTO[]>(res);
  },
  async get(id: string) {
    const res = await authedFetch(env.workshopBaseUrl, `/parties/${id}`);
    return asJson<PartyDetailDTO>(res);
  },
  async create(name: string) {
    const res = await authedFetch(env.workshopBaseUrl, "/parties", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return asJson<PartyDTO>(res);
  },
  async rename(id: string, name: string) {
    const res = await authedFetch(env.workshopBaseUrl, `/parties/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    return asJson<PartyDTO>(res);
  },
  async remove(id: string) {
    const res = await authedFetch(env.workshopBaseUrl, `/parties/${id}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`${res.status}: ${await res.text()}`);
    }
  },
  async addMember(
    partyId: string,
    input: { user_id: string; character_id?: string | null; role?: string | null },
  ) {
    const res = await authedFetch(
      env.workshopBaseUrl,
      `/parties/${partyId}/members`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return asJson<PartyMemberDTO>(res);
  },
  async patchMember(
    partyId: string,
    userId: string,
    input: { character_id?: string | null; role?: string | null },
  ) {
    const res = await authedFetch(
      env.workshopBaseUrl,
      `/parties/${partyId}/members/${userId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
    return asJson<PartyMemberDTO>(res);
  },
  async removeMember(partyId: string, userId: string) {
    const res = await authedFetch(
      env.workshopBaseUrl,
      `/parties/${partyId}/members/${userId}`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 204) {
      throw new Error(`${res.status}: ${await res.text()}`);
    }
  },
};

// ---- reroll (existing service) ----
export interface RerollCharacter {
  id: string;
  name: string;
  sheet: Record<string, unknown>;
  updated_at: string;
}

export const reroll = {
  async listCharacters() {
    const res = await authedFetch(env.rerollBaseUrl, "/characters");
    return asJson<RerollCharacter[]>(res);
  },
  async getCharacter(id: string) {
    const res = await authedFetch(env.rerollBaseUrl, `/characters/${id}`);
    return asJson<RerollCharacter>(res);
  },
  async createCharacter(name: string) {
    const res = await authedFetch(env.rerollBaseUrl, "/characters", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return asJson<RerollCharacter>(res);
  },
  async renameCharacter(id: string, name: string) {
    const res = await authedFetch(env.rerollBaseUrl, `/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    return asJson<RerollCharacter>(res);
  },
  async deleteCharacter(id: string) {
    const res = await authedFetch(env.rerollBaseUrl, `/characters/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${res.status}: ${detail}`);
    }
  },
  async updateSheet(id: string, sheet: Record<string, unknown>) {
    const res = await authedFetch(env.rerollBaseUrl, `/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify({ sheet }),
    });
    return asJson<RerollCharacter>(res);
  },
  async update(
    id: string,
    body: { name?: string; sheet?: Record<string, unknown> },
  ) {
    const res = await authedFetch(env.rerollBaseUrl, `/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return asJson<RerollCharacter>(res);
  },
  async generate(id: string, userNotes = "") {
    const res = await authedFetch(
      env.rerollBaseUrl,
      `/characters/${id}/generate`,
      {
        method: "POST",
        body: JSON.stringify({ user_notes: userNotes }),
      },
    );
    return asJson<{
      character: RerollCharacter;
      validation_errors: Array<{ rule: string; field: string; detail: string }>;
    }>(res);
  },
};
