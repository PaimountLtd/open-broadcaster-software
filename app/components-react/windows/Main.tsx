import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import fs from 'fs';
import * as remote from '@electron/remote';
import cx from 'classnames';
import Animation from 'rc-animate';
import { $t } from 'services/i18n';
import { getPlatformService } from 'services/platforms';
import ResizeBar from 'components-react/root/ResizeBar';
import * as appPages from 'components-react/pages';
import TitleBar from 'components-react/shared/TitleBar';
import ModalWrapper from 'components-react/shared/modals/ModalWrapper';
import { Services } from 'components-react/service-provider';
import { WindowsService } from 'app-services';
import { initStore, useController } from 'components-react/hooks/zustand';
import { useVuex } from 'components-react/hooks';
import antdThemes from 'styles/antd/index';
import styles from './Main.m.less';
import SideNav from 'components-react/sidebar/SideNav';
import LiveDock from 'components-react/root/LiveDock';
import StudioFooter from 'components-react/root/StudioFooter';
import Loader from 'components-react/pages/Loader';

const MainCtx = React.createContext<MainController | null>(null);

const loadedTheme = () => {
  const customizationState = localStorage.getItem('PersistentStatefulService-CustomizationService');
  if (customizationState) {
    return JSON.parse(customizationState)?.theme;
  }
};

class MainController {
  private customizationService = Services.CustomizationService;
  private navigationService = Services.NavigationService;
  private appService = Services.AppService;
  private userService = Services.UserService;
  private windowsService = Services.WindowsService;
  private scenesService = Services.ScenesService;
  private platformAppsService = Services.PlatformAppsService;
  private editorCommandsService = Services.EditorCommandsService;

  modalOptions: IModalOptions = {
    renderFn: null,
  };

  setModalOptions(opts: IModalOptions) {
    this.modalOptions = opts;
  }

  windowResizeTimeout: number | null = null;

  store = initStore({
    compactView: false,
    windowWidth: 0,
    hasLiveDock: true,
    minDockWidth: 290,
    maxDockWidth: 290,
    minEditorWidth: 500,
  });

  get dockWidth() {
    return this.customizationService.state.livedockSize;
  }

  get title() {
    return this.windowsService.state.main.title;
  }

  get page() {
    return this.navigationService.state.currentPage;
  }

  get params() {
    return this.navigationService.state.params;
  }

  get hideStyleBlockers() {
    return this.windowsService.state.mian.hideStyleBlockers;
  }

  theme(bulkLoadFinished: boolean) {
    if (bulkLoadFinished) {
      return this.customizationService.currentTheme;
    }

    return loadedTheme() || 'night-theme';
  }

  get applicationLoading() {
    return this.appService.state.loading;
  }

  get showLoadingSpinner() {
    return (
      this.appService.state.loading && this.page !== 'Onboarding' && this.page !== 'BrowseOverlays'
    );
  }

  get isLoggedIn() {
    return this.userService.isLoggedIn;
  }

  get renderDock() {
    return (
      this.isLoggedIn &&
      !this.isOnboarding &&
      this.store.hasLiveDock &&
      getPlatformService(this.userService.platform?.type)?.liveDockEnabled &&
      !this.showLoadingSpinner
    );
  }

  get liveDockSize() {
    return this.customizationService.state.livedockSize;
  }

  get isDockCollapsed() {
    return this.customizationService.state.livedockCollapsed;
  }

  get leftDock() {
    return this.customizationService.state.leftDock;
  }

  get isOnboarding() {
    return this.navigationService.state.currentPage === 'Onboarding';
  }

  get platformApps() {
    return this.platformAppsService.enabledApps;
  }

  get errorAlert() {
    return this.appService.state.errorAlert;
  }

  get mainResponsiveClasses() {
    const classes = [];

    if (this.store.compactView) {
      classes.push('main-middle--compact');
    }

    return classes.join(' ');
  }

  async isDirectory(path: string) {
    return new Promise<boolean>((resolve, reject) => {
      fs.lstat(path, (err, stats) => {
        if (err) {
          reject(err);
        }
        resolve(stats.isDirectory());
      });
    });
  }

  async onDropHandler(event: React.DragEvent) {
    if (this.page !== 'Studio') return;

    const fileList = event.dataTransfer?.files;

    if (!fileList || fileList.length < 1) return;

    const files: string[] = [];
    let fi = fileList.length;
    while (fi--) files.push(fileList.item(fi)!.path);

    const isDirectory = await this.isDirectory(files[0]).catch(err => {
      console.error('Error checking if drop is directory', err);
      return false;
    });

    if (files.length > 1 || isDirectory) {
      remote.dialog
        .showMessageBox(remote.getCurrentWindow(), {
          title: 'Streamlabs Desktop',
          message: $t('Are you sure you want to import multiple files?'),
          type: 'warning',
          buttons: [$t('Cancel'), $t('OK')],
        })
        .then(({ response }) => {
          if (!response) return;
          this.executeFileDrop(files);
        });
    } else {
      this.executeFileDrop(files);
    }
  }

  executeFileDrop(files: string[]) {
    this.editorCommandsService.actions.executeCommand(
      'AddFilesCommand',
      this.scenesService.views.activeSceneId,
      files,
    );
  }

  handleEditorWidth(width: number) {
    this.store.setState(s => (s.minEditorWidth = width));
  }

  onResizeStartHandler() {
    this.windowsService.actions.updateStyleBlockers('main', true);
  }

  onResizeStopHandler(offset: number) {
    this.setLiveDockWidth(this.customizationService.state.livedockSize + offset);
    this.windowsService.actions.updateStyleBlockers('main', false);
  }

  setLiveDockWidth(width: number) {
    this.customizationService.actions.setSettings({
      livedockSize: this.validateWidth(width),
    });
  }

  validateWidth(width: number): number {
    let constrainedWidth = Math.max(this.store.minDockWidth, width);
    constrainedWidth = Math.min(this.store.maxDockWidth, width);
    return constrainedWidth;
  }

  updateWidth() {
    const width = this.customizationService.state.livedockSize;
    if (width !== this.validateWidth(width)) this.setWidth(width);
  }

  updateLiveDockWidth() {
    if (this.liveDockSize !== this.validateWidth(this.liveDockSize)) {
      this.setLiveDockWidth(this.liveDockSize);
    }
  }

  updateStyleBlockers(val: boolean) {
    this.windowsService.actions.updateStyleBlockers('main', val);
  }

  setWidth(width: number) {
    this.customizationService.actions.setSettings({
      livedockSize: this.validateWidth(width),
    });
  }
}

export default function MainWithContext(p: { bulkLoadFinished: boolean; i18nReady: boolean }) {
  const controller = useMemo(() => new MainController(), []);
  return (
    <MainCtx.Provider value={controller}>
      <Main {...p} />
    </MainCtx.Provider>
  );
}

function Main(p: { bulkLoadFinished: boolean; i18nReady: boolean }) {
  const ctrl = useController(MainCtx);
  const {
    theme,
    dockWidth,
    showLoadingSpinner,
    errorAlert,
    hasLiveDock,
    renderDock,
    leftDock,
    applicationLoading,
    page,
    isDockCollapsed,
    liveDockSize,
    maxDockWidth,
    minDockWidth,
    mainResponsiveClasses,
    hideStyleBlockers,
  } = useVuex(() => ({
    theme: ctrl.theme(p.bulkLoadFinished),
    dockWidth: ctrl.dockWidth,
    showLoadingSpinner: ctrl.showLoadingSpinner,
    errorAlert: ctrl.errorAlert,
    renderDock: ctrl.renderDock,
    leftDock: ctrl.leftDock,
    hasLiveDock: ctrl.store.hasLiveDock,
    applicationLoading: ctrl.applicationLoading,
    page: ctrl.page,
    isDockCollapsed: ctrl.isDockCollapsed,
    liveDockSize: ctrl.liveDockSize,
    maxDockWidth: ctrl.store.maxDockWidth,
    minDockWidth: ctrl.store.minDockWidth,
    mainResponsiveClasses: ctrl.mainResponsiveClasses,
    hideStyleBlockers: ctrl.hideStyleBlockers,
  }));

  const uiReady = p.bulkLoadFinished && p.i18nReady;

  const mainWindowEl = useRef<HTMLDivElement | null>(null);
  const mainMiddleEl = useRef<HTMLDivElement | null>(null);

  function windowSizeHandler() {
    if (!hideStyleBlockers) {
      ctrl.onResizeStartHandler();
    }
    ctrl.store.setState(s => (s.windowWidth = window.innerWidth));

    if (ctrl.windowResizeTimeout) clearTimeout(ctrl.windowResizeTimeout);

    ctrl.store.setState(s => (s.hasLiveDock = s.windowWidth >= 1070));
    if (ctrl.page === 'Studio') {
      ctrl.store.setState(s => (s.hasLiveDock = s.windowWidth >= s.minEditorWidth + 100));
    }
    ctrl.windowResizeTimeout = window.setTimeout(() => {
      ctrl.updateStyleBlockers(false);
      const appRect = mainWindowEl.current?.getBoundingClientRect();
      if (!appRect) return;
      ctrl.store.setState(s => {
        s.maxDockWidth = Math.min(appRect.width - s.minEditorWidth, appRect.width / 2);
        s.minDockWidth = Math.min(290, s.maxDockWidth);
      });
      ctrl.updateWidth();
    }, 200);
  }

  useLayoutEffect(() => {
    window.addEventListener('resize', windowSizeHandler);
    const modalChangedSub = WindowsService.modalChanged.subscribe(modalOptions => {
      ctrl.setModalOptions(modalOptions);
    });

    return () => {
      window.removeEventListener('resize', windowSizeHandler);
      modalChangedSub.unsubscribe();
    };
  }, []);

  const oldTheme = useRef<string | null>(null);
  useEffect(() => {
    if (!theme) return;
    if (oldTheme.current && oldTheme.current !== theme) antdThemes[oldTheme.current].unuse();
    antdThemes[theme].use();
    oldTheme.current = theme;
  }, [theme]);

  useEffect(() => {
    if (dockWidth < 1 && mainWindowEl.current) {
      // migrate from old percentage value to the pixel value
      const appRect = mainWindowEl.current.getBoundingClientRect();
      const defaultWidth = appRect.width * 0.28;
      ctrl.setWidth(defaultWidth);
    }
  }, [uiReady]);

  useLayoutEffect(() => {
    ctrl.store.setState(
      s => (s.compactView = !!mainMiddleEl.current && mainMiddleEl.current.clientWidth < 1200),
    );
  }, [uiReady, hideStyleBlockers]);

  if (!uiReady) return <div className={cx(styles.main, theme)} />;

  const Component: React.FunctionComponent<{
    className: string;
    params: any;
    onTotalWidth: (width: number) => void;
  }> = appPages[page];

  return (
    <div
      className={cx(styles.main, theme)}
      id="mainWrapper"
      ref={mainWindowEl}
      onDrop={ctrl.onDropHandler}
    >
      <TitleBar windowId="main" className={cx({ [styles.titlebarError]: errorAlert })} />
      <div
        className={cx(styles.mainContents, {
          [styles.mainContentsRight]: renderDock && leftDock && hasLiveDock,
          [styles.mainContentsLeft]: renderDock && !leftDock && hasLiveDock,
          [styles.mainContentsOnboarding]: page === 'Onboarding',
        })}
      >
        {page !== 'Onboarding' && !showLoadingSpinner && <SideNav />}
        {renderDock && leftDock && (
          <div className={styles.liveDockWrapper}>
            <LiveDock onLeft />
            {!isDockCollapsed && (
              <ResizeBar
                className={cx(styles.liveDockResizeBar, styles.liveDockResizeBarLeft)}
                position="right"
                onResizeStart={ctrl.onResizeStartHandler}
                onResizeStop={ctrl.onResizeStopHandler}
                max={maxDockWidth}
                min={minDockWidth}
                value={liveDockSize}
              />
            )}
          </div>
        )}

        <div className={cx(styles.mainMiddle, mainResponsiveClasses)} ref={mainMiddleEl}>
          {/* <resize-observer @notify="handleResize" /> */}
          {!showLoadingSpinner && (
            <Component
              className={styles.mainPageContainer}
              params={ctrl.params}
              onTotalWidth={(width: number) => ctrl.handleEditorWidth(width)}
            />
          )}
          {!applicationLoading && page !== 'Onboarding' && <StudioFooter />}
        </div>

        {renderDock && !leftDock && (
          <div className={styles.liveDockWrapper}>
            {!isDockCollapsed && (
              <ResizeBar
                className={styles.liveDockResizeBar}
                position="left"
                onResizeStart={ctrl.onResizeStartHandler}
                onResizeStop={ctrl.onResizeStopHandler}
                max={maxDockWidth}
                min={minDockWidth}
                value={liveDockSize}
              />
            )}
            <LiveDock />
          </div>
        )}
      </div>
      <ModalWrapper renderFn={ctrl.modalOptions.renderFn} />
      <Animation transitionName="antd-fade">
        {(!uiReady || showLoadingSpinner) && (
          <div className={cx(styles.mainLoading, { [styles.initialLoading]: !uiReady })}>
            <Loader />
          </div>
        )}
      </Animation>
    </div>
  );
}
