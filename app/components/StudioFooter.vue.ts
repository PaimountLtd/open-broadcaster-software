import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Inject } from '../util/injector';
import { StreamingService } from '../services/streaming';
import StartStreamingButton from './StartStreamingButton.vue';
import TestWidgets from './TestWidgets.vue';
import PerformanceMetrics from './PerformanceMetrics.vue';
import { UserService } from '../services/user';

@Component({
  components: {
    StartStreamingButton,
    TestWidgets,
    PerformanceMetrics
  }
})
export default class StudioFooterComponent extends Vue {

  @Inject()
  streamingService: StreamingService;

  @Inject()
  userService:UserService;

  toggleRecording() {
    if (this.recording) {
      this.streamingService.stopRecording();
    } else {
      this.streamingService.startRecording();
    }
  }

  get recording() {
    return this.streamingService.isRecording;
  }

  get loggedIn() {
    return this.userService.isLoggedIn();
  }

}
