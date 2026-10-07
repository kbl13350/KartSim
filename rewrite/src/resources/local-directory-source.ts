const DATABASE_NAME = "kartsim-local-rho-directory";
const STORE_NAME = "selection";
const DIRECTORY_KEY = "data-directory";

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options: { mode: "read" }) =>
    Promise<FileSystemDirectoryHandle>;
}
type PermissionedDirectory = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
};

export function supportsLocalResourceDirectory(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
}

function openDirectoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savedDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  const database = await openDirectoryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME).get(DIRECTORY_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function saveDirectory(directory: FileSystemDirectoryHandle): Promise<void> {
  const database = await openDirectoryDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(directory, DIRECTORY_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** Returns a saved Data directory only while its read permission is valid. */
export async function recoverLocalResourceDirectory():
  Promise<FileSystemDirectoryHandle | undefined> {
  try {
    const directory = await savedDirectory();
    return directory &&
      await (directory as PermissionedDirectory).queryPermission({ mode: "read" }) === "granted"
      ? directory : undefined;
  } catch {
    return undefined;
  }
}

/** Lets the player select a Data folder, validates aaa.pk, and remembers it. */
export async function chooseLocalResourceDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("当前浏览器不支持选择本地资源目录。");
  const directory = await picker.call(window, { mode: "read" });
  try {
    await directory.getFileHandle("aaa.pk");
  } catch {
    throw new Error("请选择卡丁车客户端的 Data 文件夹（其中应有 aaa.pk）。");
  }
  await saveDirectory(directory).catch(() => {});
  return directory;
}
