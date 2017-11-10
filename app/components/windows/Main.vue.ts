import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import TopNav from '../TopNav.vue';

// Pages
import Studio from '../pages/Studio.vue';
import Dashboard from '../pages/Dashboard.vue';
import Live from '../pages/Live.vue';
import Onboarding from '../pages/Onboarding.vue';
import TitleBar from '../TitleBar.vue';
import windowMixin from '../mixins/window';
import { Inject } from '../../util/injector';
import { CustomizationService } from '../../services/customization';
import { NavigationService } from '../../services/navigation';
import { AppService } from '../../services/app';
import { UserService } from '../../services/user';
import electron from 'electron';
import { StreamingService } from '../../services/streaming';
import LiveDock from '../LiveDock.vue';
import StudioFooter from '../StudioFooter.vue';

const { remote } = electron;

@Component({
  mixins: [windowMixin],
  components: {
    TitleBar,
    TopNav,
    Studio,
    Dashboard,
    Live,
    Onboarding,
    LiveDock,
    StudioFooter
  }
})
export default class Main extends Vue {

  title = `Streamlabs OBS - Version: ${remote.process.env.SLOBS_VERSION}`;

  @Inject()
  customizationService: CustomizationService;

  @Inject()
  navigationService: NavigationService;

  @Inject()
  appService: AppService;

  @Inject()
  streamingService: StreamingService;

  @Inject()
  userService: UserService;

  get page() {
    return this.navigationService.state.currentPage;
  }

  get nightTheme() {
    return this.customizationService.nightMode;
  }

  get applicationLoading() {
    return this.appService.state.loading;
  }

  get isStreaming() {
    return this.streamingService.isStreaming;
  }

  get isLoggedIn() {
    return this.userService.isLoggedIn();
  }

  get leftDock() {
    return this.customizationService.state.leftDock;
  }

}
