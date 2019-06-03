import electron from 'electron';
import { Subject, Subscription } from 'rxjs';
import { delay, take } from 'rxjs/operators';
import overlay, { OverlayThreadStatus } from '@streamlabs/game-overlay';
import { Inject, InitAfter } from 'services/core';
import { LoginLifecycle, UserService } from 'services/user';
import { CustomizationService } from 'services/customization';
import { getPlatformService } from '../platforms';
import { WindowsService } from '../windows';
import { PersistentStatefulService } from 'services/core/persistent-stateful-service';
import { mutation } from 'services/core/stateful-service';
import { $t } from 'services/i18n';

const { BrowserWindow } = electron.remote;

export type GameOverlayState = {
  isEnabled: boolean;
  isShowing: boolean;
  isPreviewEnabled: boolean;
  previewMode: boolean;
  opacity: number;
  windowIds: {
    chat: number;
    recentEvents: number;
  };
};

@InitAfter('UserService')
@InitAfter('WindowsService')
export class GameOverlayService extends PersistentStatefulService<GameOverlayState> {
  @Inject() userService: UserService;
  @Inject() customizationService: CustomizationService;
  @Inject() windowsService: WindowsService;

  static defaultState: GameOverlayState = {
    isEnabled: false,
    isShowing: false,
    isPreviewEnabled: true,
    previewMode: false,
    opacity: 100,
    windowIds: {
      chat: null,
      recentEvents: null,
      // overlayControls: null,
    },
  };

  windows: {
    chat: Electron.BrowserWindow;
    recentEvents: Electron.BrowserWindow;
    // overlayControls: Electron.BrowserWindow;
  } = {} as any;

  previewWindows: {
    chat: Electron.BrowserWindow;
    recentEvents: Electron.BrowserWindow;
    // overlayControls: Electron.BrowserWindow;
  } = {} as any;

  overlayWindow: Electron.BrowserWindow;
  onWindowsReady: Subject<Electron.BrowserWindow> = new Subject<Electron.BrowserWindow>();
  onWindowsReadySubscription: Subscription;
  lifecycle: LoginLifecycle;

  async initialize() {
    if (!this.state.isEnabled) return;

    this.lifecycle = await this.userService.withLifecycle({
      init: this.initializeOverlay,
      destroy: this.destroyOverlay,
      context: this,
    });
  }

  async initializeOverlay() {
    overlay.start();

    this.onWindowsReadySubscription = this.onWindowsReady
      .pipe(
        take(Object.keys(this.windows).length),
        delay(5000), // so recent events has time to load
      )
      .subscribe({ complete: () => this.createWindowOverlays() });

    const [containerX, containerY] = this.getWindowContainerStartingPosition();

    this.createBrowserWindows(containerX, containerY);
    await this.configureWindows(containerX, containerY);
  }

  createBrowserWindows(containerX: number, containerY: number) {
    const commonWindowOptions = {
      backgroundColor: this.customizationService.themeBackground,
      show: false,
      frame: false,
      width: 300,
      height: 300,
      x: containerX,
      y: containerY,
      skipTaskbar: true,
      thickFrame: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, offscreen: true },
    };

    this.overlayWindow = new BrowserWindow({ ...commonWindowOptions, height: 600, width: 600 });

    this.windows.recentEvents = new BrowserWindow({
      ...commonWindowOptions,
      width: 600,
      parent: this.overlayWindow,
    });
    this.previewWindows.recentEvents = this.windowsService.createOneOffWindowForOverlay({
      ...commonWindowOptions,
      // @ts-ignore
      width: 600,
      webPreferences: { offscreen: false },
      isFullScreen: true,
      componentName: 'OverlayPlaceholder',
      title: $t('Recent Events'),
    });

    this.windows.chat = new BrowserWindow({
      ...commonWindowOptions,
      height: 600,
      parent: this.overlayWindow,
    });
    this.previewWindows.chat = this.windowsService.createOneOffWindowForOverlay({
      ...commonWindowOptions,
      // @ts-ignore
      height: 600,
      webPreferences: { offscreen: false },
      isFullScreen: true,
      componentName: 'OverlayPlaceholder',
      title: $t('Chat'),
    });

    // Unneeded window without interactivity
    // this.windows.overlayControls = this.windowsService.createOneOffWindowForOverlay(
    //   {
    //     ...commonWindowOptions,
    //     // @ts-ignore
    //     webPreferences: {},
    //     parent: this.overlayWindow,
    //     x: containerX - 600,
    //     y: containerY + 300,
    //     width: 600,
    //     height: 300,
    //     // OneOffWindow options
    //     isFullScreen: true,
    //     componentName: 'OverlayWindow',
    //   },
    //   'overlay',
    // );
  }

  async configureWindows(containerX: number, containerY: number) {
    this.windows.recentEvents.webContents.once('did-finish-load', () => {
      this.onWindowsReady.next(this.windows.recentEvents);
    });

    this.windows.chat.webContents.once('did-finish-load', () =>
      this.onWindowsReady.next(this.windows.chat),
    );

    this.windows.recentEvents.setBounds({
      x: containerX - 600,
      y: containerY,
      width: 600,
      height: 300,
    });

    this.windows.chat.setBounds({ x: containerX, y: containerY, width: 300, height: 600 });

    this.windows.recentEvents.loadURL(this.userService.recentEventsUrl());
    this.windows.chat.loadURL(
      await getPlatformService(this.userService.platform.type).getChatUrl(
        this.customizationService.isDarkTheme ? 'night' : 'day',
      ),
    );

    // this.windows.overlayControls.webContents.once('dom-ready', async () => {
    //   this.onWindowsReady.next(this.windows.overlayControls);
    // });
  }

  showOverlay() {
    overlay.show();
    this.TOGGLE_OVERLAY(true);

    // Force a refresh to trigger a paint event
    Object.values(this.windows).forEach(win => win.webContents.invalidate());
  }

  hideOverlay() {
    overlay.hide();
    this.TOGGLE_OVERLAY(false);
  }

  toggleOverlay() {
    if (overlay.getStatus() !== OverlayThreadStatus.Running || !this.state.isEnabled) {
      return;
    }

    if (this.state.previewMode) this.setPreviewMode(false);

    this.state.isShowing ? this.hideOverlay() : this.showOverlay();
  }

  isEnabled() {
    return this.state.isEnabled;
  }

  async setEnabled(shouldEnable: boolean = true) {
    const shouldStart = shouldEnable && !this.state.isEnabled;
    const shouldStop = !shouldEnable && this.state.isEnabled;

    if (shouldStart) await this.initializeOverlay();
    if (shouldStop) this.destroyOverlay();

    this.SET_ENABLED(shouldEnable);
    this.setPreviewEnabled(true);
  }

  async setPreviewMode(previewMode: boolean) {
    if (this.state.isShowing) this.hideOverlay();
    if (!this.state.isEnabled) return;
    this.SET_PREVIEW_MODE(previewMode);
    if (previewMode) {
      Object.values(this.previewWindows).forEach(win => win.show());
    } else {
      Object.keys(this.previewWindows).forEach(async key => {
        const win: electron.BrowserWindow = this.previewWindows[key];
        const overlayId = this.state.windowIds[key];

        const [x, y] = win.getPosition();
        const { width, height } = win.getBounds();

        await overlay.setPosition(overlayId, x, y, width, height);
        win.hide();
      });
    }
  }

  setOverlayOpacity(percentage: number) {
    this.SET_OPACITY(percentage);
    if (!this.state.isEnabled) return;
    Object.keys(this.windows).forEach(key => {
      const overlayId = this.state.windowIds[key];

      overlay.setTransparency(overlayId, percentage * 2.55);
    });
  }

  setPreviewEnabled(shouldEnable: boolean = true) {
    this.SET_PREVIEW_ENABLED(shouldEnable);
  }

  @mutation()
  private SET_PREVIEW_ENABLED(isEnabled: boolean) {
    this.state.isPreviewEnabled = isEnabled;
  }

  @mutation()
  private TOGGLE_OVERLAY(isShowing: boolean) {
    this.state.isShowing = isShowing;
  }

  @mutation()
  private SET_ENABLED(shouldEnable: boolean = true) {
    this.state.isEnabled = shouldEnable;
  }

  @mutation()
  private SET_PREVIEW_MODE(previewMode: boolean = true) {
    this.state.previewMode = previewMode;
  }

  @mutation()
  private SET_WINDOW_ID(window: string, id: number) {
    this.state.windowIds[window] = id;
  }

  @mutation()
  private SET_OPACITY(val: number) {
    this.state.opacity = val;
  }

  async destroy() {
    if (!this.lifecycle) return;
    await this.lifecycle.destroy();
  }

  async destroyOverlay() {
    if (this.state.isEnabled) {
      await overlay.stop();
      if (this.onWindowsReadySubscription) this.onWindowsReadySubscription.unsubscribe();
      if (this.windows) Object.values(this.windows).forEach(win => win.destroy());
      if (this.previewWindows) Object.values(this.previewWindows).forEach(win => win.destroy());
    }
  }

  private createWindowOverlays() {
    Object.keys(this.windows).forEach((key: string) => {
      const win: electron.BrowserWindow = this.windows[key];
      const overlayId = overlay.addHWND(win.getNativeWindowHandle());

      if (overlayId.toString() === '-1') {
        this.overlayWindow.hide();
        throw new Error('Error creating overlay');
      }

      this.SET_WINDOW_ID(key, overlayId);

      const [x, y] = win.getPosition();
      const { width, height } = win.getBounds();

      overlay.setPosition(overlayId, x, y, width, height);
      overlay.setTransparency(overlayId, this.state.opacity * 2.55);

      win.webContents.on('paint', (event, dirty, image) => {
        overlay.paintOverlay(overlayId, width, height, image.getBitmap());
      });
      win.webContents.setFrameRate(10);
    });
  }

  private getWindowContainerStartingPosition() {
    const display = this.windowsService.getMainWindowDisplay();

    return [display.workArea.height / 2 + 200, display.workArea.height / 2 - 300];
  }
}
