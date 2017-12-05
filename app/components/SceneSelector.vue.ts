import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Inject } from '../util/injector';
import Selector from './Selector.vue';
import { ScenesService } from '../services/scenes';
import { Menu } from '../util/menus/Menu';
import { ScenesTransitionsService } from '../services/scenes-transitions';
import { ScenesCollectionsService } from '../services/scenes-collections/config';
import { AppService } from '../services/app';
import DropdownMenu from './shared/DropdownMenu.vue';

@Component({
  components: { Selector, DropdownMenu },
})
export default class SceneSelector extends Vue {

  @Inject()
  scenesService: ScenesService;

  @Inject()
  scenesCollectionsService: ScenesCollectionsService;

  @Inject()
  appService: AppService;

  @Inject()
  scenesTransitionsService: ScenesTransitionsService;

  menu = new Menu();

  created() {
    this.menu.append({
      label: 'Duplicate',
      click: () => this.scenesService.showDuplicateScene(this.scenesService.activeScene.name)
    });
    this.menu.append({
      label: 'Rename',
      click: () => this.scenesService.showNameScene(this.scenesService.activeScene.name)
    });
  }

  makeActive(id: string) {
    this.scenesService.makeSceneActive(id);
  }

  handleSort(data: any) {
    this.scenesService.setSceneOrder(data.order);
  }

  addScene() {
    this.scenesService.showNameScene();
  }

  removeScene() {
    this.scenesService.removeScene(this.activeSceneId);
  }

  showTransitions() {
    this.scenesTransitionsService.showSceneTransitions();
  }

  loadConfig(configName: string) {
    this.appService.loadConfig(configName);
  }

  get scenes() {
    return this.scenesService.scenes.map(scene => {
      return {
        name: scene.name,
        value: scene.id
      };
    });
  }

  get scenesCollections() {
    return this.scenesCollectionsService.state.scenesCollections;
  }

  get activeConfig() {
    return this.scenesCollectionsService.state.activeCollection;
  }

  get activeSceneId() {
    if (this.scenesService.activeScene) {
      return this.scenesService.activeScene.id;
    }

    return null;
  }

  addCollection() {
    this.scenesCollectionsService.showNameConfig();
  }


  duplicateCollection() {
    this.scenesCollectionsService.showNameConfig({
      scenesCollectionToDuplicate: this.activeConfig
    });
  }


  renameCollection() {
    this.scenesCollectionsService.showNameConfig({ rename: true });
  }


  removeCollection() {
    if (!confirm(`remove ${this.activeConfig} ?`)) return;
    this.appService.removeCurrentConfig();
  }
}
