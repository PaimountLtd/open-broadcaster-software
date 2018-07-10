import { Component, Prop, Watch } from 'vue-property-decorator';
import {
  ChatBoxService,
  IChatBoxData
} from 'services/widget-settings/chat-box';

import WidgetWindow from 'components/windows/WidgetWindow.vue';
import WidgetSettings from './WidgetSettings.vue';

import * as comps from 'components/shared/widget-inputs';
import WFormGroup from 'components/shared/widget-inputs/WFormGroup.vue';
import { $t } from 'services/i18n';

@Component({
  components: {
    WidgetWindow,
    WFormGroup,
    ...comps
  }
})
export default class ChatBox extends WidgetSettings<IChatBoxData, ChatBoxService> {
  textColorTooltip = $t('A hex code for the base text color.');

  backgroundColorTooltip = $t(
    'A hex code for the widget background. This is for preview purposes only. It will not be shown in your stream.'
  );

  backgroundColorDescription = $t(
    'Note: This background color is for preview purposes only. It will not be shown in your stream.'
  );
}
