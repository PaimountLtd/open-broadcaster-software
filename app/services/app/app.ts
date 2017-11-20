import { StatefulService, mutation } from '../stateful-service';
import { OnboardingService } from '../onboarding';
import { ScenesCollectionsService, OverlaysPersistenceService } from '../scenes-collections';
import { HotkeysService } from '../hotkeys';
import { UserService } from '../user';
import { ShortcutsService } from '../shortcuts';
import { Inject } from '../../util/injector';
import electron from 'electron';
import { ScenesTransitionsService } from '../scenes-transitions';
import { SourcesService } from '../sources';
import { ScenesService } from '../scenes';
import { VideoService } from '../video';
import { StreamInfoService } from '../stream-info';
import { track } from '../usage-statistics';
import { IpcServerService } from '../ipc-server';
import { TcpServerService } from '../tcp-server';
import { IAppServiceApi } from './app-api';
import { StreamlabelsService } from '../streamlabels';

interface IAppState {
  loading: boolean;
  argv: string[];
}

/**
 * Performs operations that happen once at startup and shutdown. This service
 * mainly calls into other services to do the heavy lifting.
 */
export class AppService extends StatefulService<IAppState> implements IAppServiceApi {

  @Inject()
  onboardingService: OnboardingService;

  @Inject()
  scenesCollectionsService: ScenesCollectionsService;

  @Inject()
  overlaysPersistenceService: OverlaysPersistenceService;

  @Inject()
  hotkeysService: HotkeysService;

  @Inject()
  userService: UserService;

  @Inject()
  shortcutsService: ShortcutsService;

  @Inject() streamInfoService: StreamInfoService;

  static initialState: IAppState = {
    loading: true,
    argv: []
  };

  private autosaveInterval: number;

  @Inject()
  scenesTransitionsService: ScenesTransitionsService;

  @Inject()
  sourcesService: SourcesService;

  @Inject()
  scenesService: ScenesService;

  @Inject()
  videoService: VideoService;


  @Inject() streamlabelsService: StreamlabelsService;
  @Inject() private ipcServerService: IpcServerService;
  @Inject() private tcpServerService: TcpServerService;

  @track('app_start')
  load() {

    // This is synchronous and can take a really long time for large configs.
    // Setting a timeout allows the spinner and loading text to be drawn to
    // the screen before starting on the slow synchronous operation.
    // TODO: loading should be async
    setTimeout(() => {
      let loadingPromise: Promise<void>;

      // If we're not showing the onboarding steps, we should load
      // the config file.  Otherwise the onboarding process will
      // handle it based on what the user wants.
      const onboarded = this.onboardingService.startOnboardingIfRequired();
      if (!onboarded) {
        if (this.scenesCollectionsService.hasConfigs()) {
          loadingPromise = this.loadConfig('', { saveCurrent: false });
        } else {
          this.scenesCollectionsService.switchToBlankConfig();
          loadingPromise = Promise.resolve();
        }
      } else {
        loadingPromise = Promise.resolve();
      }

      loadingPromise.then(() => {

        if (onboarded) this.enableAutoSave();

        electron.ipcRenderer.on('shutdown', () => {
          electron.ipcRenderer.send('acknowledgeShutdown');
          this.shutdownHandler();
        });

        this.userService;
        this.shortcutsService;
        this.streamlabelsService;

        // Pre-fetch stream info
        this.streamInfoService;

        this.ipcServerService.listen();
        this.tcpServerService.listen();
        this.FINISH_LOADING();
      });
    }, 500);


  }

  /**
   * reset current scene collection and load new one
   */
  loadConfig(configName?: string, options = { saveCurrent: true }): Promise<void> {
    return new Promise(resolve => {
      this.START_LOADING();

      window.setTimeout(() => {
        // wait while current config will be saved
        (options.saveCurrent ? this.scenesCollectionsService.rawSave() : Promise.resolve()).then(() => {
          this.reset();

          this.scenesCollectionsService.load(configName).then(() => {
            this.scenesService.makeSceneActive(this.scenesService.activeSceneId);
            this.hotkeysService.bindHotkeys();
            this.enableAutoSave();
            this.FINISH_LOADING();
            resolve();
          });
        });
      }, 500);
    });
  }

  /**
   * the main process sends argv string here
   */
  setArgv(argv: string[]) {
    this.SET_ARGV(argv);
  }

  /**
   * Loads an overlay file as a new scene collection
   * @param collectionName The name of the new scene collection
   * @param overlayPath The path to the overlay file
   */
  async loadOverlay(collectionName: string, overlayPath: string) {
    this.START_LOADING();

    // Make sure the current collection is saved
    await this.scenesCollectionsService.rawSave();

    this.reset();
    this.scenesCollectionsService.switchToEmptyConfig(collectionName);
    await this.overlaysPersistenceService.loadOverlay(overlayPath);
    this.scenesService.makeSceneActive(this.scenesService.activeSceneId);

    // Save the newly loaded config
    await this.scenesCollectionsService.rawSave();

    this.enableAutoSave();
    this.FINISH_LOADING();
  }


  /**
   * remove the config and load the new one
   */
  removeCurrentConfig() {
    this.scenesCollectionsService.removeConfig();
    if (this.scenesCollectionsService.hasConfigs()) {
      this.loadConfig('', { saveCurrent: false });
    } else {
      this.switchToBlankConfig();
    }
  }


  /**
   * reset current scenes and switch to blank config
   */
  switchToBlankConfig(configName?: string) {
    this.reset();
    this.scenesCollectionsService.switchToBlankConfig(configName);
    this.enableAutoSave();
  }


  @track('app_close')
  private shutdownHandler() {
    this.disableAutosave();

    this.ipcServerService.stopListening();
    this.tcpServerService.stopListening();
    this.scenesCollectionsService.rawSave().then(() => {
      this.reset();
      this.videoService.destroyAllDisplays();
      this.scenesTransitionsService.release();
      electron.ipcRenderer.send('shutdownComplete');
    });
  }


  /**
   * cleanup all created objects
   */
  reset() {
    this.disableAutosave();

    // we should remove inactive scenes first to avoid the switching between scenes
    this.scenesService.scenes.forEach(scene => {
      if (scene.id === this.scenesService.activeSceneId) return;
      scene.remove(true);
    });
    if (this.scenesService.activeScene) this.scenesService.activeScene.remove(true);

    this.sourcesService.sources.forEach(source => { if (source.type !== 'scene') source.remove(); });
    this.hotkeysService.unregisterAll();
  }

  private enableAutoSave() {
    this.autosaveInterval = window.setInterval(() => {
      this.scenesCollectionsService.save();
    }, 60 * 1000);
  }

  private disableAutosave() {
    clearInterval(this.autosaveInterval);
  }

  @mutation()
  private START_LOADING() {
    this.state.loading = true;
  }

  @mutation()
  private FINISH_LOADING() {
    this.state.loading = false;
  }

  @mutation()
  private SET_ARGV(argv: string[]) {
    this.state.argv = argv;
  }

}
