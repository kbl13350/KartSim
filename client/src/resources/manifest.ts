/** The three resource generations understood by the downloaded client. */
export type ResourceVersion = "p3528" | "p3543" | "p3553";

export interface ContainerSpec {
  readonly name: string;
  readonly size: number;
  readonly mtimeMs: number;
  readonly sha256: string;
}

export interface ResourceManifest {
  readonly version: ResourceVersion;
  readonly revision: string;
  readonly files: readonly ContainerSpec[];
}

export type ResourceFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Browser fetch may require Window as its receiver. */
export const browserFetch: ResourceFetch = (url, init) => globalThis.fetch(url, init);

const SHA256 = /^[a-f\d]{64}$/i;
const CONTAINER_NAME = /^(?:aaa\.pk|[^/\\]+\.rho|DataPack\d+_\d{5}\.rho5)$/i;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function version(value: unknown): value is ResourceVersion {
  return value === "p3528" || value === "p3543" || value === "p3553";
}

/** Reject malformed or ambiguous manifests before touching OPFS. */
export function parseResourceManifest(
  input: unknown,
  expectedVersion?: ResourceVersion,
): ResourceManifest {
  if (!object(input) || !version(input.version)) {
    throw new Error("资源清单版本无效。");
  }
  if (expectedVersion && input.version !== expectedVersion) {
    throw new Error(`请求 ${expectedVersion}，但资源清单返回 ${input.version}。`);
  }
  if (typeof input.revision !== "string" || !SHA256.test(input.revision)) {
    throw new Error("资源清单修订号无效。");
  }
  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error("资源清单 files 无效。");
  }

  const seen = new Set<string>();
  const files = input.files.map((item: unknown): ContainerSpec => {
    if (!object(item) || typeof item.name !== "string" ||
        !CONTAINER_NAME.test(item.name) || item.name === "." || item.name === "..") {
      throw new Error("资源清单包含无效文件名。");
    }
    const key = item.name.toLowerCase();
    if (seen.has(key)) throw new Error(`资源清单包含同名容器：${item.name}。`);
    seen.add(key);
    if (!Number.isSafeInteger(item.size) || (item.size as number) <= 0) {
      throw new Error(`资源 ${item.name} 的 size 无效。`);
    }
    if (typeof item.mtimeMs !== "number" || !Number.isFinite(item.mtimeMs) || item.mtimeMs < 0) {
      throw new Error(`资源 ${item.name} 的 mtimeMs 无效。`);
    }
    if (typeof item.sha256 !== "string" || !SHA256.test(item.sha256)) {
      throw new Error(`资源 ${item.name} 的 SHA-256 无效。`);
    }
    return {
      name: item.name,
      size: item.size as number,
      mtimeMs: item.mtimeMs,
      sha256: item.sha256.toLowerCase(),
    };
  });

  return { version: input.version, revision: input.revision.toLowerCase(), files };
}

export async function loadResourceManifest(
  expectedVersion: ResourceVersion = "p3553",
  fetcher: ResourceFetch = browserFetch,
  url = `/__${expectedVersion}/resources`,
): Promise<ResourceManifest> {
  const response = await fetcher(url, { cache: "no-store" });
  if (response.status !== 200) {
    throw new Error(`资源清单读取失败：HTTP ${response.status}。`);
  }
  return parseResourceManifest(await response.json(), expectedVersion);
}
