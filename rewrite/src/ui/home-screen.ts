import type { LobbyHomeView } from "./lobby-home-view";
import type { MainMenuPage, MainMenuView, SingleCategory, StoryMenuChapter } from "./main-menu-view";

/**
 * The two pages over Ready that the taskbar's 首页 and 单人游戏 switch between:
 * the lobby home and the release 单人游戏 page. One is shown at a time.
 */
export class HomeScreen {
  private current?: MainMenuPage;

  constructor(readonly lobby: LobbyHomeView, readonly single: MainMenuView,
    page: MainMenuPage = "home") {
    this.setPage(page);
  }

  get page(): MainMenuPage {
    return this.current ?? "home";
  }

  get singleCategory(): SingleCategory {
    return this.single.singleCategory;
  }

  setPage(page: MainMenuPage): void {
    if (page === this.current) return;
    this.current = page;
    this.lobby.hidden = page !== "home";
    this.single.element.hidden = page !== "single";
    if (page !== "single") return;
    this.single.setPage("single");
    this.single.render();
  }

  selectCategory(category: SingleCategory): void {
    this.single.selectCategory(category);
  }

  setStoryChapters(chapters: StoryMenuChapter[] | undefined): void {
    this.single.setStoryChapters(chapters);
  }

  showNotice(message: string): void {
    if (this.page === "home") this.lobby.showNotice(message);
    else this.single.showNotice(message);
  }

  /** Keep the lobby's current frame for the multiplayer page behind its panels. */
  captureBackdrop(): void {
    this.lobby.captureBackdrop();
  }

  dispose(): void {
    this.lobby.dispose();
    this.single.dispose();
  }
}
