import {
  decodeGhostFrames,
  encodeGhostFrames,
  type GhostFrameRecord,
} from "./frame-codec";

const DATABASE_NAME = "kartrider-web:p3528";
const STORE_NAME = "ghosts";
const DATABASE_VERSION = 3;

export interface GhostParticipant {
  equipment: unknown;
  record: GhostFrameRecord;
  rawRecording?: unknown;
}

export interface GhostRecord {
  schemaVersion?: 3;
  zCeiling: number;
  timeBase?: string;
  originalKsvBytes?: Uint8Array;
  participants: GhostParticipant[];
}

export interface RawGhostRecording {
  metadata: {
    timeBase?: string;
    equipment: unknown;
    [field: string]: unknown;
  };
  [field: string]: unknown;
}

interface PersistedParticipant {
  equipment: unknown;
  frames: ArrayBuffer;
  rawRecording?: unknown;
}

interface PersistedGhostRecord {
  schemaVersion: 2 | 3;
  zCeiling: number;
  timeBase?: string;
  originalKsvBytes?: ArrayBuffer;
  participants: PersistedParticipant[];
}

/** Copy a typed-array view into a standalone ArrayBuffer for IndexedDB. */
export function copyGhostBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

/** Convert a database row back to the in-memory shape used by the game. */
export function restoreGhostRecord(row: PersistedGhostRecord): GhostRecord {
  return {
    ...(row.schemaVersion === 3 ? { schemaVersion: 3 as const } : {}),
    zCeiling: row.zCeiling,
    ...(row.timeBase ? { timeBase: row.timeBase } : {}),
    ...(row.originalKsvBytes
      ? { originalKsvBytes: new Uint8Array(row.originalKsvBytes) }
      : {}),
    participants: row.participants.map(participant => ({
      equipment: participant.equipment,
      record: participant.frames && participant.frames.byteLength > 0
        ? decodeGhostFrames(new Uint8Array(participant.frames), row.zCeiling)
        : { stamps: [] },
      ...(participant.rawRecording ? { rawRecording: participant.rawRecording } : {}),
    })),
  };
}

/** Persisted v2/v3 row shape, including the release client's exact schema rule. */
export function persistGhostRecord(record: GhostRecord): PersistedGhostRecord {
  return {
    schemaVersion: record.originalKsvBytes ||
      record.participants.some(participant => participant.rawRecording) ? 3 : 2,
    zCeiling: record.zCeiling,
    timeBase: record.timeBase,
    originalKsvBytes: record.originalKsvBytes && copyGhostBytes(record.originalKsvBytes),
    participants: record.participants.map(participant => ({
      equipment: participant.equipment,
      frames: copyGhostBytes(encodeGhostFrames(participant.record, record.zCeiling)),
      ...(participant.rawRecording ? { rawRecording: participant.rawRecording } : {}),
    })),
  };
}

/** Retain an imported raw recording before any frame conversion is possible. */
export function persistRawGhostRecord(
  recording: RawGhostRecording,
  originalKsvBytes?: Uint8Array,
): PersistedGhostRecord {
  return {
    schemaVersion: 3,
    zCeiling: 0,
    timeBase: recording.metadata.timeBase,
    originalKsvBytes: originalKsvBytes && copyGhostBytes(originalKsvBytes),
    participants: [{
      equipment: recording.metadata.equipment,
      rawRecording: recording,
      frames: copyGhostBytes(new Uint8Array()),
    }],
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 请求失败。"));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 事务已中止。"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB 事务失败。"));
  });
}

/** The game's versioned IndexedDB store for time-attack Ghost records. */
export class GhostRecordStore {
  private database?: Promise<IDBDatabase>;

  async get(key: string): Promise<GhostRecord | undefined> {
    const database = await this.open();
    const row = await requestResult(
      database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key),
    ) as PersistedGhostRecord | undefined;
    if (row !== undefined) return restoreGhostRecord(row);
  }

  async list(): Promise<Array<{ key: string; record: GhostRecord }>> {
    try {
      const request = (await this.open())
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .openCursor();
      return await new Promise((resolve, reject) => {
        const records: Array<{ key: string; record: GhostRecord }> = [];
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return resolve(records);
          records.push({ key: String(cursor.key), record: restoreGhostRecord(cursor.value as PersistedGhostRecord) });
          cursor.continue();
        };
      });
    } catch {
      return [];
    }
  }

  async put(key: string, record: GhostRecord): Promise<void> {
    const database = await this.open();
    const row = persistGhostRecord(record);
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(row, key);
    await transactionComplete(transaction);
  }

  async putRaw(key: string, recording: RawGhostRecording, originalKsvBytes?: Uint8Array): Promise<void> {
    const database = await this.open();
    const row = persistRawGhostRecord(recording, originalKsvBytes);
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(row, key);
    await transactionComplete(transaction);
  }

  async delete(key: string): Promise<void> {
    const transaction = (await this.open()).transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    await transactionComplete(transaction);
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      const indexedDb = globalThis.indexedDB;
      if (!indexedDb) throw new Error("IndexedDB 不可用，幽灵轨迹无法持久化。");
      this.database = new Promise((resolve, reject) => {
        const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = event => {
          const database = request.result;
          const store = database.objectStoreNames.contains(STORE_NAME)
            ? request.transaction!.objectStore(STORE_NAME)
            : database.createObjectStore(STORE_NAME);
          if (event.oldVersion === 1) {
            const cursorRequest = store.openCursor();
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (!cursor) return;
              const oldRecord = cursor.value as Record<string, unknown>;
              if (oldRecord && "frames" in oldRecord) {
                cursor.update({
                  schemaVersion: 2,
                  zCeiling: oldRecord.zCeiling,
                  participants: [{ equipment: oldRecord.equipment, frames: oldRecord.frames }],
                });
              }
              cursor.continue();
            };
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败。"));
        request.onblocked = () => reject(new Error("IndexedDB 打开被阻止。"));
      });
    }
    return this.database;
  }
}

// Release alias used by generated compatibility code.
export { GhostRecordStore as Th0 };
