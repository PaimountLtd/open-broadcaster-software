import { Component, Prop } from 'vue-property-decorator';
import { Multiselect } from 'vue-multiselect';
import { FontLibraryService } from '../../../services/font-library';
import { Inject } from '../../../util/injector';
import { SourcesService } from '../../../services/sources';
import { Input, IGoogleFont } from './Input';
import FontSizeSelector from './FontSizeSelector.vue';
import path from 'path';


@Component({
  components: { Multiselect, FontSizeSelector }
})
export default class GoogleFontSelector extends Input<IGoogleFont> {

  @Inject()
  fontLibraryService: FontLibraryService;

  @Inject()
  sourcesService: SourcesService;

  @Prop()
  value: IGoogleFont;

  fontFamilies: string[] = [];

  fontStyles: string[] = [];

  selectedFamily = '';

  selectedStyle = '';

  /* TrueType/OpenType defines fonts to have a
   * preferred family name. For instance Arial Black
   * has a preferred family name of 'Arial' and a 
   * preferred subfamily name of 'Black'. 
   *
   * GDI+ and consequently the plugin doesn't 
   * understand this at all. GDI+ only understands 
   * the following for styles: 
   *
   * `Bold | Italic | Bold Italic | Regular
   *
   * As a result, anything that isn't part of the style must
   * be part of the family name. For example, in the eyes of
   * GDI+, Arial Black has a family name of 'Arial Black' and
   * a subfamily name of Regular. 
   * The plugin itself takes the family name as the style
   * as a bitmask of flags */
  actualFamily = '';

  actualStyle: number = 0;

  loading = true;

  created() {
    this.loading = true;
    this.fontLibraryService.getManifest().then(manifest => {
      this.loading = false;
      this.fontFamilies = manifest.families.map(family => family.name);

      if (this.value.path) this.updateSelectionFromPath();
    });
  }

  updateSelectionFromPath() {
    this.fontLibraryService.lookupFontInfo(this.value.path).then(info => {
      this.selectedFamily = info.family;
      this.selectedStyle = info.style;

      this.updateStyles();
    });
  }

  updateStyles() {
    if (this.selectedFamily) {
      this.fontLibraryService.findFamily(this.selectedFamily).then(fam => {
        this.fontStyles = fam.styles.map(sty => sty.name);
      });
    }
  }

  setFamily(familyName: string) {
    this.loading = true;
    this.selectedFamily = familyName;

    this.fontLibraryService.findFamily(familyName).then(family => {
      const style = family.styles[0];

      this.updateStyles();
      this.setStyle(style.name);
    });
  }

  setStyle(styleName: string) {
    this.loading = true;
    this.selectedStyle = styleName;

    this.fontLibraryService.findStyle(this.selectedFamily, styleName).then(style => {
      this.fontLibraryService.downloadFont(style.file).then(fontPath => {
        [this.actualFamily, this.actualStyle] = 
          this.fontLibraryService.getSettingsFromFont(this.selectedFamily, style.name);

        this.value.face = this.actualFamily;
        this.value.flags = this.actualStyle;

        this.emitInput({ ...this.value, path: fontPath });
        this.loading = false;
      });
    });
  }

  setSize(size: string) {
    this.emitInput({ ...this.value, size });
  }

}
