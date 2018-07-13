import Vue from 'vue';
import electron from 'electron';
import { Component } from 'vue-property-decorator';
import { Inject } from '../../util/injector';
import { WindowsService } from '../../services/windows';
import {
  MediaGalleryService,
  IMediaGalleryFile,
  IMediaGalleryInfo
} from 'services/media-gallery';
import windowMixin from '../mixins/window';
import { $t } from 'services/i18n';
import ModalLayout from '../ModalLayout.vue';
import { async } from "rxjs/scheduler/async";

const getTypeMap = () => ({
  title: {
    image: $t('Images'),
    audio: $t('Sounds')
  },
  noFilesCopy: {
    image: $t('You don\'t have any uploaded images!'),
    audio: $t('You don\'t have any uploaded sounds!')
  },
  noFilesBtn: {
    image: $t('Upload An Image'),
    audio: $t('Upload A Sound')
  }
});

@Component({
  components: { ModalLayout },
  mixins: [windowMixin]
})
export default class MediaGallery extends Vue {
  @Inject() windowsService: WindowsService;
  @Inject() mediaGalleryService: MediaGalleryService;

  dragOver = false;
  busy = false;
  selectedFile: IMediaGalleryFile = null;
  type: string = null;
  category: string = null;
  galleryInfo: IMediaGalleryInfo = null;

  private promiseId = this.windowsService.getChildWindowQueryParams().promiseId;
  private typeMap = getTypeMap();

  async mounted() {
    this.galleryInfo = await this.mediaGalleryService.fetchGalleryInfo();
  }

  get files() {
    if (!this.galleryInfo) return [];

    return this.galleryInfo.files.filter(file => {
      if (this.category === 'stock' && !file.isStock) return false;
      if (this.type && file.type !== this.type) return false;
      return true;
    });
  }

  get title() {
    return this.typeMap.title[this.type] || $t('All Files');
  }

  get noFilesCopy() {
    return (
      this.typeMap.noFilesCopy[this.type] ||
      $t("You don't have any uploaded files!")
    );
  }

  get noFilesBtn() {
    return this.typeMap.noFilesBtn[this.type] || $t('Upload A File');
  }

  get totalUsage( ) {
    return this.galleryInfo ? this.galleryInfo.totalUsage : 0;
  }

  get maxUsage( ) {
    return this.galleryInfo ? this.galleryInfo.maxUsage : 0;
  }

  get usagePct() {
    return this.galleryInfo ? this.totalUsage / this.maxUsage : 0;
  }

  get totalUsageLabel() {
    return this.formatBytes(this.totalUsage, 2);
  }

  get maxUsageLabel() {
    return this.formatBytes(this.maxUsage, 2);
  }

  formatBytes(bytes: number, argPlaces: number) {
    if (!bytes) {
      return '0KB';
    }

    const places = argPlaces || 1;
    const divisor = Math.pow(10, places);
    const base = Math.log(bytes) / Math.log(1024);
    const suffix = ['', 'KB', 'MB', 'GB', 'TB'][Math.floor(base)];
    return (
      Math.round(Math.pow(1024, base - Math.floor(base)) * divisor) / divisor +
      suffix
    );
  }

  onDragOver() {
    this.dragOver = true;
  }

  onDragEnter() {
    this.dragOver = true;
  }

  onDragLeave() {
    this.dragOver = false;
  }

  openFilePicker() {
    electron.remote.dialog.showOpenDialog(
      electron.remote.getCurrentWindow(),
      { properties: ['openFile', 'multiSelections'] },
      this.upload
    );
  }

  handleFileDrop(e: DragEvent) {
    const mappedFiles = Array.from(e.dataTransfer.files).map(file => file.path);
    this.upload(mappedFiles);
  }

  handleTypeFilter(type: string, category: string) {
    if (type !== this.type || category !== this.category) {
      this.type = type;
      this.category = category;
    }
  }

  handleBrowseGalleryClick() {
    this.category = 'stock';
  }

  selectFile(file: IMediaGalleryFile, select: boolean) {
    this.selectedFile = file;

    if (file.type === 'audio') {
      const audio = new Audio(file.href);
      audio.play();
    }

    if (select === true) this.handleSelect();
  }

  handleSelect() {
    this.mediaGalleryService.resolveFileSelect(
      this.promiseId,
      this.selectedFile
    );
    this.windowsService.closeChildWindow();
  }

  async handleDelete() {
    if (this.selectedFile) {
      electron.remote.dialog.showMessageBox(
        electron.remote.getCurrentWindow(),
        {
          type: 'warning',
          message: $t(
            'Are you sure you want to delete this file? This action is irreversable.'
          ),
          buttons: [$t('Cancel'), $t('OK')]
        },
        async ok => {
          if (!ok || !this.selectedFile) return;
          this.galleryInfo = await this.mediaGalleryService.deleteFile(this.selectedFile);
          this.selectedFile = null;
        }
      );
    }
  }

  async handleDownload() {
    electron.remote.dialog.showSaveDialog(
      electron.remote.getCurrentWindow(),
      { defaultPath: this.selectedFile.fileName },
      async filename => {
        if (!this.selectedFile) return;
        this.busy = true;
        await this.mediaGalleryService.downloadFile(
          filename,
          this.selectedFile
        );
        this.busy = false;
      }
    );
  }

  async upload(filepaths: string[]) {
    this.busy = true;
    this.galleryInfo = await this.mediaGalleryService.upload(filepaths);
    this.busy = false;
  }

  handleCopySuccess() {
    return;
  }

  handleCopyError() {
    return;
  }
}
