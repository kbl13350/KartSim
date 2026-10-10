/** Thin room-dialog entry points and gameplay category validation. */

interface NewRoomSettings { name: string; capacity: number; password: string }

type CreateRoomForm<T> = (options: unknown, mode: string, nickname: string,
  submit: (settings: NewRoomSettings, channel?: string) => void,
  channel?: string, gameplay?: string) => Promise<T>;

type MessageBox<T> = (options: { cancel(): void }, title: string,
  message: string, confirm: () => void,
  labels?: { yes?: string; no?: string }, noticeOnly?: boolean) => Promise<T>;

export async function confirmLobbyMessage<T>(messageBox: MessageBox<T>,
  options: { cancel(): void }, title: string, message: string,
  confirm: () => void, labels?: { yes?: string; no?: string }): Promise<T> {
  return messageBox(options, title, message, confirm, labels);
}

export async function noticeLobbyMessage<T>(messageBox: MessageBox<T>,
  options: { cancel(): void }, title: string, message: string): Promise<T> {
  return messageBox(options, title, message, options.cancel, undefined, true);
}

export async function createLobbyRoomDialog<T>(createForm: CreateRoomForm<T>,
  options: unknown, mode: string, nickname: string,
  submit: (settings: NewRoomSettings, channel?: string) => void): Promise<T> {
  return createForm(options, mode, nickname, submit);
}

export interface LobbyDialogCategoryDependencies {
  mode(channel: string): string;
  validateGameplay(gameplay: string): void;
  channelNames(gameplay: string): Record<string, string>;
}

export async function createOrdinaryRoomDialog<T>(createForm: CreateRoomForm<T>,
  options: unknown, channel: string, nickname: string,
  submit: (settings: NewRoomSettings & { channelName: string }) => void,
  dependencies: LobbyDialogCategoryDependencies): Promise<T> {
  return createForm(options, dependencies.mode(channel), nickname,
    (settings, selected) => {
      if (!selected) throw new Error("创建普通竞速房间缺少类别");
      submit({ ...settings, channelName: selected });
    }, channel);
}

export async function createGameplayRoomDialog<T>(createForm: CreateRoomForm<T>,
  options: unknown, gameplay: string, channel: string,
  nickname: string,
  submit: (settings: NewRoomSettings & { channelName: string;
    gameplay: string }) => void,
  dependencies: LobbyDialogCategoryDependencies): Promise<T> {
  dependencies.validateGameplay(gameplay);
  if (!dependencies.channelNames(gameplay)[channel]) {
    throw new Error("该玩法未开放此建房类别");
  }
  return createForm(options, dependencies.mode(channel), nickname,
    (settings, selected) => {
      if (!selected) throw new Error("创建房间缺少类别");
      submit({ ...settings, channelName: selected, gameplay });
    }, channel, gameplay);
}
