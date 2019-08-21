import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';
import { Inject } from '../../services/core/injector';
import ModalLayout from '../ModalLayout.vue';
import NavMenu from '../shared/NavMenu.vue';
import NavItem from '../shared/NavItem.vue';
import GenericFormGroups from 'components/obs/inputs/GenericFormGroups.vue';
import { WindowsService } from '../../services/windows';
import { ISettingsServiceApi, ISettingsSubCategory } from '../../services/settings';
import ExtraSettings from '../ExtraSettings.vue';
import DeveloperSettings from '../DeveloperSettings';
import InstalledApps from '../InstalledApps.vue';
import Hotkeys from '../Hotkeys.vue';
import OverlaySettings from 'components/OverlaySettings.vue';
import NotificationsSettings from 'components/NotificationsSettings.vue';
import AppearanceSettings from 'components/AppearanceSettings';
import ExperimentalSettings from 'components/ExperimentalSettings.vue';
import RemoteControlSettings from 'components/RemoteControlSettings.vue';
import LanguageSettings from 'components/LanguageSettings.vue';
import GameOverlaySettings from 'components/GameOverlaySettings';
import FacemaskSettings from 'components/FacemaskSettings.vue';
import SearchablePages from 'components/shared/SearchablePages';
import FormInput from 'components/shared/inputs/FormInput.vue';

@Component({
  components: {
    ModalLayout,
    SearchablePages,
    GenericFormGroups,
    NavMenu,
    NavItem,
    ExtraSettings,
    Hotkeys,
    DeveloperSettings,
    OverlaySettings,
    NotificationsSettings,
    AppearanceSettings,
    RemoteControlSettings,
    ExperimentalSettings,
    LanguageSettings,
    InstalledApps,
    GameOverlaySettings,
    FacemaskSettings,
    FormInput,
  },
})
export default class Settings extends Vue {
  @Inject() settingsService: ISettingsServiceApi;
  @Inject() windowsService: WindowsService;

  $refs: { settingsContainer: HTMLElement };

  searchStr = '';
  searchResultPages: string[] = [];
  categoryName: string = 'General';
  settingsData: ISettingsSubCategory[] = [];
  icons: Dictionary<string> = {
    General: 'icon-overview',
    Stream: 'fas fa-globe',
    Output: 'fas fa-microchip',
    Video: 'fas fa-film',
    Audio: 'icon-audio',
    Hotkeys: 'icon-settings',
    'Game Overlay': 'icon-full-screen',
    Advanced: 'fas fa-cogs',
    Developer: 'far fa-file-code',
    'Scene Collections': 'icon-themes',
    Notifications: 'icon-notifications',
    Appearance: 'icon-settings-3-1',
    Facemasks: 'icon-face-masks-3',
    'Remote Control': 'fas fa-play-circle',
    Experimental: 'fas fa-flask',
    'Installed Apps': 'icon-store',
  };

  mounted() {
    this.categoryName = this.getInitialCategoryName();
    this.settingsData = this.settingsService.getSettingsFormData(this.categoryName);
  }

  getInitialCategoryName() {
    if (this.windowsService.state.child.queryParams) {
      return this.windowsService.state.child.queryParams.categoryName || 'General';
    }
    return 'General';
  }

  get categoryNames() {
    return this.settingsService.getCategories();
  }

  save(settingsData: ISettingsSubCategory[]) {
    this.settingsService.setSettings(this.categoryName, settingsData);
    this.settingsData = this.settingsService.getSettingsFormData(this.categoryName);
  }

  done() {
    this.windowsService.closeChildWindow();
  }

  @Watch('categoryName')
  onCategoryNameChangedHandler(categoryName: string) {
    this.settingsData = this.getSettingsData(categoryName);
    this.$refs.settingsContainer.scrollTop = 0;
  }

  getSettingsData(categoryName: string) {
    return this.settingsService.getSettingsFormData(categoryName);
  }

  onSearchCompletedHandler(foundPages: string[]) {
    this.searchResultPages = foundPages;
    // if there are not search results for the current page than switch to the first found page
    if (foundPages.length && !foundPages.includes(this.categoryName)) {
      this.categoryName = foundPages[0];
    }
  }
}
