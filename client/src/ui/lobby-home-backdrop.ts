/**
 * The last frame of the lobby home scene, kept so the multiplayer room list
 * can show the same lobby, blurred, behind its panels; and the same frame
 * without the rider and kart, for the shop opened away from the lobby (its
 * stage draws the rider itself).
 */

export interface LobbyBackdropImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

let backdrop: LobbyBackdropImage | undefined;

export function lobbyHomeBackdrop(): LobbyBackdropImage | undefined {
  return backdrop;
}

export function setLobbyHomeBackdrop(image: LobbyBackdropImage | undefined): void {
  if (image) backdrop = image;
}

let shopBackdrop: LobbyBackdropImage | undefined;

/** The lobby's last frame without its rider and kart, if one was taken. */
export function lobbyShopBackdrop(): LobbyBackdropImage | undefined {
  return shopBackdrop;
}

export function setLobbyShopBackdrop(image: LobbyBackdropImage | undefined): void {
  if (image) shopBackdrop = image;
}
