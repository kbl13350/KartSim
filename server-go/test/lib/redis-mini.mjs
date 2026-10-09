// Minimal RESP2 client so the smoke tests can inspect and clean their own
// Redis key prefix without npm dependencies. One command at a time is enough.
import net from "node:net";

class RedisError extends Error {}

/** Parses one RESP value at `offset`; undefined when more bytes are needed. */
function parse(buffer, offset) {
  if (offset >= buffer.length) return undefined;
  const end = buffer.indexOf("\r\n", offset);
  if (end < 0) return undefined;
  const type = String.fromCharCode(buffer[offset]);
  const line = buffer.toString("utf8", offset + 1, end);
  const next = end + 2;
  switch (type) {
    case "+": return { value: line, next };
    case "-": return { value: new RedisError(line), next };
    case ":": return { value: Number(line), next };
    case "$": {
      const length = Number(line);
      if (length < 0) return { value: null, next };
      if (buffer.length < next + length + 2) return undefined;
      return { value: buffer.toString("utf8", next, next + length), next: next + length + 2 };
    }
    case "*": {
      const count = Number(line);
      if (count < 0) return { value: null, next };
      const items = [];
      let cursor = next;
      for (let index = 0; index < count; index++) {
        const item = parse(buffer, cursor);
        if (!item) return undefined;
        items.push(item.value);
        cursor = item.next;
      }
      return { value: items, next: cursor };
    }
    default:
      throw new RedisError(`Unexpected RESP type ${JSON.stringify(type)}`);
  }
}

const encode = args => Buffer.concat([
  Buffer.from(`*${args.length}\r\n`),
  ...args.map(arg => {
    const value = Buffer.from(String(arg));
    return Buffer.concat([Buffer.from(`$${value.length}\r\n`), value, Buffer.from("\r\n")]);
  }),
]);

const globEscape = text => text.replace(/[*?[\]\\]/g, character => `\\${character}`);

export class MiniRedis {
  constructor(socket, timeoutMs) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.buffer = Buffer.alloc(0);
    this.pending = [];
    socket.on("data", chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      for (;;) {
        let parsed;
        try { parsed = parse(this.buffer, 0); }
        catch (error) { this.failAll(error); return; }
        if (!parsed) break;
        this.buffer = this.buffer.subarray(parsed.next);
        const waiter = this.pending.shift();
        if (!waiter) continue;
        clearTimeout(waiter.timer);
        if (parsed.value instanceof RedisError) waiter.reject(parsed.value);
        else waiter.resolve(parsed.value);
      }
    });
    socket.on("error", error => this.failAll(error));
    socket.on("close", () => this.failAll(new Error("Redis connection closed")));
  }

  /** Connects to "host:port", authenticates and selects the database. */
  static async connect(address, { password, db = 0, timeoutMs = 3000 } = {}) {
    const separator = address.lastIndexOf(":");
    const host = (separator < 0 ? address : address.slice(0, separator))
      .replace(/^\[|\]$/g, "") || "127.0.0.1";
    const port = separator < 0 ? 6379 : Number(address.slice(separator + 1));
    const socket = net.createConnection({ host, port });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Redis ${address}: connect timed out`));
      }, timeoutMs);
      socket.once("connect", () => { clearTimeout(timer); resolve(); });
      socket.once("error", error => { clearTimeout(timer); reject(error); });
    });
    const client = new MiniRedis(socket, timeoutMs);
    if (password) await client.command("AUTH", password);
    if (Number(db) !== 0) await client.command("SELECT", db);
    return client;
  }

  failAll(error) {
    for (const waiter of this.pending.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  command(...args) {
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      waiter.timer = setTimeout(() => {
        this.socket.destroy(new Error(`Redis ${args[0]} timed out`));
      }, this.timeoutMs);
      this.pending.push(waiter);
      this.socket.write(encode(args));
    });
  }

  /** All keys that start with `prefix` (SCAN, never KEYS). */
  async keys(prefix) {
    const found = [];
    let cursor = "0";
    do {
      const [next, batch] = await this.command("SCAN", cursor, "MATCH", `${globEscape(prefix)}*`, "COUNT", 500);
      found.push(...batch);
      cursor = next;
    } while (cursor !== "0");
    return [...new Set(found)];
  }

  /** Deletes every key that starts with `prefix`; returns how many were removed. */
  async deletePrefix(prefix) {
    const keys = await this.keys(prefix);
    let removed = 0;
    for (let index = 0; index < keys.length; index += 200) {
      removed += await this.command("DEL", ...keys.slice(index, index + 200));
    }
    return removed;
  }

  close() {
    this.socket.end();
  }
}
