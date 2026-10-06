export interface GarageFactoryConfiguration {
  active: boolean;
  abilities: number[];
}

export interface GarageFactoryRecord {
  category: number;
  itemId: number;
  serial: number;
  status: number;
  reserved: number;
  slots: number[];
  protectionSlots: number[];
  protectionCounts: number[];
}

export interface GarageFactoryResponse {
  resultCode: number;
  record?: GarageFactoryRecord;
}

export interface GarageFactoryRequest {
  category: number;
  itemId: number;
  serial: number;
  operation: string;
  itemCategory: number;
  itemIdToUse: number;
}

export type GarageFactoryRecordKey = Pick<GarageFactoryRecord, "category" | "itemId" | "serial">;

function sameFactoryVehicle(record: GarageFactoryRecord, key: GarageFactoryRecordKey): boolean {
  return record.category === key.category && record.itemId === key.itemId && record.serial === key.serial;
}

function storeFactoryRecord(
  records: GarageFactoryRecord[], resultCode: number, record: GarageFactoryRecord,
): GarageFactoryRecord[] {
  if (resultCode !== 0) return records;
  const index = records.findIndex(existing => sameFactoryVehicle(existing, record));
  const stored = {
    ...record,
    reserved: index < 0 ? 0 : records[index]!.reserved,
    slots: [...record.slots],
    protectionSlots: [...record.protectionSlots],
    protectionCounts: [...record.protectionCounts],
  };
  return index < 0 ? [...records, stored]
    : records.map((existing, position) => position === index ? stored : existing);
}

/** Local record protocol used by the garage's Factory page. */
export class GarageFactorySession {
  private stored: GarageFactoryRecord[];
  private selected?: GarageFactoryRecordKey;
  private inFlight = false;
  private pageRevision = 0;
  private failure?: string;

  constructor(
    records: GarageFactoryRecord[],
    private readonly send: (request: GarageFactoryRequest) => Promise<GarageFactoryResponse>,
  ) {
    this.stored = records.map(record => ({
      ...record,
      slots: [...record.slots],
      protectionSlots: [...record.protectionSlots],
      protectionCounts: [...record.protectionCounts],
    }));
  }

  get records(): GarageFactoryRecord[] { return this.stored; }
  get pending(): boolean { return this.inFlight; }
  get error(): string | undefined { return this.failure; }
  get current(): GarageFactoryRecord | undefined {
    return this.selected && this.stored.find(record => sameFactoryVehicle(record, this.selected!));
  }

  select(key?: GarageFactoryRecordKey): void {
    this.selected = key && { category: key.category, itemId: key.itemId, serial: key.serial };
    this.pageRevision++;
    this.failure = undefined;
  }

  async request(operation: string, itemCategory: number, itemIdToUse: number): Promise<void> {
    if (this.inFlight) throw new Error("改装请求尚未完成。");
    if (!this.selected) throw new Error("请先选择车辆。");
    const key = { ...this.selected };
    const revision = this.pageRevision;
    this.inFlight = true;
    this.failure = undefined;
    try {
      const response = await this.send({ ...key, operation, itemCategory, itemIdToUse });
      if (response.resultCode !== 0) throw new Error(`改装失败（${response.resultCode}）。`);
      if (!response.record || !sameFactoryVehicle(response.record, key))
        throw new Error("改装响应与请求车辆不匹配。");
      this.stored = storeFactoryRecord(this.stored, response.resultCode, response.record);
    } catch (error) {
      if (revision === this.pageRevision)
        this.failure = error instanceof Error ? error.message : "改装请求失败。";
      throw error;
    } finally {
      this.inFlight = false;
    }
  }
}

export interface GarageFactoryCommitHost {
  selected: { itemId: number; engineGrade?: number; [key: string]: unknown };
  configuration: unknown;
  options: { speed: unknown };
  factorySession?: GarageFactorySession;
  factorySessionVehicleKey: unknown;
  disposed: boolean;
  pageMode: string;
  status: { textContent: string };
  serial(): number;
  base(): unknown;
  nativeFactoryAllowed(): boolean;
  factoryVehicleKey(vehicle: GarageFactoryCommitHost["selected"]): unknown;
  publishCurrentState(): void;
  updateControls(): void;
}

export interface GarageFactoryCommitDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number): Record<string, unknown> &
    { factory?: GarageFactoryConfiguration };
  validateConfiguration(base: unknown, engineGrade: number,
    equipment: Record<string, unknown>, speed: unknown): void;
  writeConfiguration(configuration: unknown, itemId: number, serial: number,
    equipment: Record<string, unknown>): unknown;
  createSession(records: GarageFactoryRecord[],
    send: (request: GarageFactoryRequest) => Promise<GarageFactoryResponse>): GarageFactorySession;
}

/** Apply Factory abilities immediately, then confirm the local record and roll back on failure. */
export async function setGarageFactory(
  host: GarageFactoryCommitHost,
  factory: GarageFactoryConfiguration,
  dependencies: GarageFactoryCommitDependencies,
): Promise<void> {
  if (host.factorySession?.pending) return;
  const selected = host.selected;
  const serial = host.serial();
  const currentSelection = () => !host.disposed && host.selected.itemId === selected.itemId &&
    host.serial() === serial && host.pageMode === "factory";
  const previousConfiguration = host.configuration;
  let committed = false;
  try {
    if (!host.nativeFactoryAllowed())
      throw new Error("当前车辆不支持原版车辆改装。");
    const equipment = {
      ...dependencies.currentConfiguration(host.configuration, selected.itemId, serial),
      factory,
    };
    dependencies.validateConfiguration(host.base(), host.selected.engineGrade ?? 0,
      equipment, host.options.speed);
    const toRecord = (value: GarageFactoryConfiguration): GarageFactoryRecord => ({
      category: 3,
      itemId: selected.itemId,
      serial,
      status: value.active ? 0 : 1,
      reserved: 0,
      slots: [...value.abilities],
      protectionSlots: [65535, 65535],
      protectionCounts: [0, 0],
    });
    const oldFactory = dependencies.currentConfiguration(
      host.configuration, selected.itemId, serial).factory;
    host.configuration = dependencies.writeConfiguration(
      host.configuration, selected.itemId, serial, equipment);
    host.publishCurrentState();
    committed = true;
    const session = dependencies.createSession(oldFactory ? [toRecord(oldFactory)] : [],
      async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        return { resultCode: 0, record: toRecord(factory) };
      });
    host.factorySession = session;
    host.factorySessionVehicleKey = host.factoryVehicleKey(selected);
    session.select({ category: 3, itemId: selected.itemId, serial });
    const request = session.request(oldFactory ? (factory.active ? "activate" : "reset") : "install", 0, 0);
    host.status.textContent = "自定义粒子效果已立即应用，正在确认本地记录……";
    host.updateControls();
    await request;
    if (host.disposed) return;
    const current = session.current!;
    const latest = dependencies.currentConfiguration(host.configuration, selected.itemId, serial);
    host.configuration = dependencies.writeConfiguration(host.configuration, selected.itemId,
      serial, { ...latest, factory: { active: current.status === 0, abilities: [...current.slots] } });
    host.publishCurrentState();
    if (currentSelection()) host.status.textContent = "";
  } catch (error) {
    if (committed && !host.disposed && host.selected === selected) {
      host.configuration = previousConfiguration;
      host.publishCurrentState();
    }
    if (!host.disposed && host.selected === selected)
      host.status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    if (!host.disposed) host.updateControls();
  }
}
