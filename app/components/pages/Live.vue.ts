import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import SceneSelector from '../SceneSelector.vue';
import Mixer from '../Mixer.vue';
import { UserService } from '../../services/user';
import { Inject } from '../../util/injector';
import Display from '../Display.vue';
import { CustomizationService } from '../../services/customization';
import Slider from '../shared/Slider.vue';

@Component({
  components: {
    SceneSelector,
    Mixer,
    Display,
    Slider
  }
})
export default class Live extends Vue {
  @Inject() userService: UserService;
  @Inject() customizationService: CustomizationService;

  get previewSize() {
    return this.customizationService.state.previewSize;
  }

  set previewSize(previewSize: number) {
    this.customizationService.setSettings({ previewSize });
  }

  get previewEnabled() {
    return this.customizationService.state.livePreviewEnabled && !this.performanceModeEnabled;
  }

  get performanceModeEnabled() {
    return this.customizationService.state.performanceMode;
  }

  set previewEnabled(value: boolean) {
    this.customizationService.setLivePreviewEnabled(value);
  }

  get recenteventsUrl() {
    return this.userService.widgetUrl('recent-events');
  }
}
