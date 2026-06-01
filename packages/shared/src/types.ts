// Shared domain types across the tavern (web) and workshop (FastAPI mirrors via Pydantic).

export type UUID = string;

// ReRoll character shape — minimal projection of what the tavern app needs.
export interface Character {
  id: UUID;
  user_id: UUID;
  name: string;
  sheet: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Magic Mirror
export type PortraitStatus = "pending" | "ready" | "failed";

export interface Portrait {
  id: UUID;
  user_id: UUID;
  character_id: UUID | null;
  image_url: string | null;
  prompt: string;
  model: string;
  status: PortraitStatus;
  cost_usd: number | null;
  created_at: string;
}

// Friends + Parties
export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface Friendship {
  requester_id: UUID;
  addressee_id: UUID;
  status: FriendshipStatus;
  created_at: string;
}

export interface Party {
  id: UUID;
  owner_id: UUID;
  name: string;
  created_at: string;
}

export interface PartyMember {
  party_id: UUID;
  user_id: UUID;
  character_id: UUID | null;
  role: string | null;
}

// Tavern Bard
export type BardScope = "feat" | "party" | "lore";
export type SongStatus = "pending" | "ready" | "failed";

export interface WorldLore {
  id: UUID;
  user_id: UUID;
  title: string;
  body: string;
  created_at: string;
}

export interface BardSong {
  id: UUID;
  user_id: UUID;
  scope: BardScope;
  source_id: UUID | null;
  prompt: string;
  lyrics: string | null;
  audio_url: string | null;
  model: string;
  duration_s: number | null;
  status: SongStatus;
  cost_usd: number | null;
  created_at: string;
}
