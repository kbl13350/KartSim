/**
 * Server-authoritative account state shared by the garage, home top bar and
 * shop (server-go/ECONOMY.md section 8). This file is the interface contract;
 * the implementation is BrowserAccountSession (browser-session.ts), installed
 * by the startup login gate through account-runtime.ts installAccountSession().
 */

export type Currency = "coupon" | "lucci" | "koin";

export interface AccountSummary {
  account: { username: string; nickname: string; admin: boolean; createdAt: number };
  progress: {
    level: number; exp: number; levelExp: number; nextLevelExp: number | null;
    glove: string; gloveName: string; maxLevel: number;
  };
  wallet: Record<Currency, number>;
  stats: { races: number; wins: number; podiums: number; points: number };
  onboarded: boolean;
}

export interface InventoryItem {
  category: number;
  itemId: number;
  systemKey?: string;
  quantity: number;
  /** Unix milliseconds; null means permanent. */
  expiresAt: number | null;
  source: string;
}

export interface AccountSession {
  /** The data service origin. */
  readonly backendOrigin: string;
  summary(): AccountSummary | undefined;
  inventory(): readonly InventoryItem[];
  owns(category: number, itemId: number, systemKey?: string, now?: number): boolean;
  /** Re-reads /api/account and /api/inventory and notifies subscribers. */
  refresh(): Promise<void>;
  subscribe(listener: () => void): () => void;
  /** A data-service request with the Bearer token; path starts with "/api/" or "/multiplayer/". */
  authorizedFetch(path: string, init?: RequestInit): Promise<Response>;
}

let current: AccountSession | undefined;

/** The signed-in session, or undefined before login. */
export function currentAccountSession(): AccountSession | undefined {
  return current;
}

/** Installed by the login flow; cleared on logout. */
export function setCurrentAccountSession(session: AccountSession | undefined): void {
  current = session;
}
