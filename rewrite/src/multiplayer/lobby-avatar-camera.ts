/** Camera framing rules for lobby kart and linked character previews. */

interface PreviewCamera {
  position: { set(x: number, y: number, z: number): void };
  lookAt(x: number, y: number, z: number): void;
}

export interface LobbyAvatarCameraDependencies {
  degToRad(degrees: number): number;
  radToDeg(radians: number): number;
  createCamera(fieldOfView: number, aspect: number,
    near: number, far: number): PreviewCamera;
}

export function createLobbyAvatarCamera(dependencies: LobbyAvatarCameraDependencies,
  team: number | null,
  reverse: boolean, linkedCharacterId = 0, alwaysLink = false,
  kartId = 0): PreviewCamera {
  const view = team === 1 ? 4 : team === 2 ? 5 : reverse ? 3 : 2;
  const origin = view === 2 ? [0, -2.8, 0.7]
    : view === 3 ? [-0.7, 2.4, 0.9]
      : [view === 4 ? 1 : -1, -2.4, 0.9];
  const target = [0, 0, 0.84];
  let distanceScale = view === 3 ? 1 : 1.1;
  if (linkedCharacterId) {
    if (alwaysLink) {
      if (view !== 3) {
        origin[1] = -2.8;
        distanceScale *= 0.85;
      }
      if (kartId === 900 && team) {
        target[0] = team === 1 ? -0.5 : 0.5;
      }
    } else {
      origin[2] = origin[2]! + 1;
      target[2] = target[2]! + 1;
      distanceScale *= 0.9;
    }
  }
  const aspect = 245 / 308;
  const fieldOfView = dependencies.radToDeg(2 * Math.atan(
    Math.tan(dependencies.degToRad(75 / distanceScale) / 2) / aspect));
  const camera = dependencies.createCamera(fieldOfView, aspect, 0.5, 100);
  camera.position.set(origin[0]!, origin[2]!, -origin[1]!);
  camera.lookAt(target[0]!, target[2]!, -0);
  return camera;
}
