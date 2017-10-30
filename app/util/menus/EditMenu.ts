import { Inject } from '../../util/injector';
import { Menu } from './Menu';
import { WindowsService } from '../../services/window';
import { SourcesService } from '../../services/sources';
import { ScenesService } from '../../services/scenes';
import { ClipboardService } from '../../services/clipboard';
import { SourceTransformMenu } from './SourceTransformMenu';
import { SourceFiltersService } from '../../services/source-filters';

interface IEditMenuOptions {
  selectedSourceId?: string;
  selectedSceneItemId?: string;
  selectedSceneId?: string;
}

export class EditMenu extends Menu {

  @Inject()
  private sourcesService: SourcesService;

  @Inject()
  private scenesService: ScenesService;

  @Inject()
  private sourceFiltersService: SourceFiltersService;

  @Inject()
  private clipboardService: ClipboardService;

  private source = this.sourcesService.getSource(this.options.selectedSourceId);
  private scene = this.scenesService.getScene(this.options.selectedSceneId);
  private sceneItem = this.scene ? this.scene.getItem(this.options.selectedSceneItemId) : null;

  constructor(private options: IEditMenuOptions) {
    super();

    this.appendEditMenuItems();
  }


  private appendEditMenuItems() {

    if (this.scene) {
      this.append({
        label: 'Paste (Reference)',
        enabled: this.clipboardService.hasSources(),
        accelerator: 'CommandOrControl+V',
        click: () => this.clipboardService.pasteReference()
      });

      this.append({
        label: 'Paste (Duplicate)',
        enabled: this.clipboardService.hasSources(),
        click: () => this.clipboardService.pasteDuplicate()
      });
    }

    if (this.sceneItem) {

      this.append({
        label: 'Copy',
        accelerator: 'CommandOrControl+C',
        click: () => this.clipboardService.copy()
      });

      this.append({ type: 'separator' });

      this.append({
        label: 'Rename',
        click: () => this.sourcesService.showRenameSource(this.sceneItem.name)
      });

      this.append({
        label: 'Remove',
        accelerator: 'Delete',
        click: () => this.scene.removeItem(this.sceneItem.sceneItemId)
      });

      this.append({
        label: 'Transform',
        submenu: this.transformSubmenu().menu
      });

      const visibilityLabel = this.sceneItem.visible ? 'Hide' : 'Show';

      this.append({
        label: visibilityLabel,
        click: () => {
          this.sceneItem.setVisibility(!this.sceneItem.visible);
        }
      });
    }

    if (this.source) {

      this.append({ type: 'separator' });

      this.append({
        label: 'Filters',
        click: () => {
          this.showFilters();
        }
      });

      this.append({
        label: 'Copy filters',
        click: () => this.clipboardService.copyFilters()
      });

      this.append({
        label: 'Paste filters',
        click: () => this.clipboardService.pasteFilters(this.source.sourceId),
        enabled: this.clipboardService.hasFilters()
      });

      this.append({ type: 'separator' });

      this.append({
        label: 'Properties',
        click: () => {
          this.showProperties();
        },
        enabled: this.source.hasProps()
      });
    }

    if (!this.sceneItem && !this.source) {

      this.append({ type: 'separator' });

      this.append({
        label: 'Lock all sources',
        click: () => this.scenesService.setLockOnAllScenes(true)
      });

      this.append({
        label: 'Unlock all sources',
        click: () => this.scenesService.setLockOnAllScenes(false)
      });
    }
  }

  private showFilters() {
    // TODO: This should take an id
    this.sourceFiltersService.showSourceFilters(this.source.name);
  }


  private showProperties() {
    this.sourcesService.showSourceProperties(this.source.sourceId);
  }


  private transformSubmenu() {
    return new SourceTransformMenu(this.scene.id, this.sceneItem.sceneItemId);
  }
}
