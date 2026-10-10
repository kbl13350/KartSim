import type { UiRectangle } from "./scrollbar";
import type { BinaryXmlNode } from "../codecs/binary-xml";

export interface GridLayoutConfig {
  columns: number;
  maxRows: number;
  linePaging: boolean;
  gapX: number;
  gapY: number;
  margin: { left: number; top: number; right: number; bottom: number };
}

export interface GridLayout {
  rect: UiRectangle;
  cells: UiRectangle[];
  firstItem: number;
  positionCount: number;
}

function numericList(value: string, expected: number, name: string): number[] {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== expected) throw new Error(`${name}=${value} 必须包含 ${expected} 个数。`);
  return parts.map(part => {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part)) {
      throw new Error(`${name}=${value} 包含无效数字。`);
    }
    const number = Number(part);
    if (!Number.isFinite(number)) throw new Error(`${name}=${value} 包含非有限值。`);
    return Math.fround(number);
  });
}

/** Read grid margins and row movement from packaged BML attributes. */
export function gridLayoutConfig(node: BinaryXmlNode): GridLayoutConfig {
  const attribute = (name: string) => node.attributes.find(item => item.name === name)?.value;
  const [left, top, right, bottom] = numericList(attribute("clientMargin") ?? "3 3 3 3",
    4, "clientMargin");
  const [gapX, gapY] = numericList(attribute("alignMargin") ?? "2 2", 2, "alignMargin");
  return {
    columns: Number(attribute("alignSize") ?? 3),
    maxRows: Number(attribute("maxLine") ?? 1),
    linePaging: attribute("linePaging") === "true",
    gapX: gapX!, gapY: gapY!,
    margin: { left: left!, top: top!, right: right!, bottom: bottom! },
  };
}

/** Count the positions exposed by the original grid scroll bar. */
export function gridPositionCount(config: GridLayoutConfig, itemCount: number): number {
  if (itemCount <= config.columns * config.maxRows) return 1;
  const rows = Math.ceil(itemCount / config.columns);
  return config.linePaging
    ? rows - config.maxRows + 1
    : config.maxRows === 0
      ? 1
      : Math.ceil(rows / config.maxRows);
}

export function gridPageSize(config: GridLayoutConfig): number {
  return config.columns * config.maxRows;
}

export function gridStepSize(config: GridLayoutConfig): number {
  return config.linePaging ? config.columns : gridPageSize(config);
}

/** The visible grid extent shrinks for a partially filled last page. */
export function gridExtent(config: GridLayoutConfig, viewport: UiRectangle,
  cell: UiRectangle, itemCount: number): UiRectangle {
  const visibleColumns = Math.min(itemCount, config.columns);
  const visibleRows = Math.max(1, Math.min(Math.ceil(itemCount / config.columns), config.maxRows));
  const width = itemCount === 0 ? 0 : cell.width;
  const height = itemCount === 0 ? 0 : cell.height;
  return {
    ...viewport,
    width: visibleColumns * width + (visibleColumns - 1) * config.gapX +
      config.margin.left + config.margin.right,
    height: visibleRows * height + (visibleRows - 1) * config.gapY +
      config.margin.top + config.margin.bottom,
  };
}

/** Cells and first item for either page-by-page or line-by-line movement. */
export function gridLayout(config: GridLayoutConfig, viewport: UiRectangle,
  cell: UiRectangle, itemCount: number, position: number): GridLayout {
  const firstItem = position * gridStepSize(config);
  const rect = gridExtent(config, viewport, cell, itemCount);
  const visibleCount = Math.min(itemCount - firstItem, gridPageSize(config));
  const cells = Array.from({ length: Math.max(0, visibleCount) }, (_, index) => ({
    x: viewport.x + config.margin.left + (index % config.columns) * (cell.width + config.gapX),
    y: viewport.y + config.margin.top + Math.floor(index / config.columns) * (cell.height + config.gapY),
    width: cell.width,
    height: cell.height,
  }));
  return { rect, cells, firstItem, positionCount: gridPositionCount(config, itemCount) };
}
