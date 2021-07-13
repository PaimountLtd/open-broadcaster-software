import {
  IWidgetData,
  IWidgetSettings,
  WidgetDefinitions,
  WidgetSettingsService,
  WidgetType,
} from 'services/widgets';
import { WIDGET_INITIAL_STATE } from './widget-settings';
import { InheritMutations } from 'services/core/stateful-service';

export interface IPollSettings extends IWidgetSettings {
  background_color_primary: string;
  background_color_secondary: string;
  bar_background_color: string;
  bar_color: string;
  custom_css: string;
  custom_enabled: boolean;
  custom_html: string;
  custom_js: string;
  fade_time: number;
  font: string;
  font_color_primary: string;
  font_color_secondary: string;
  option_font_size: number;
  option_font_weight: number;
  show_on_closed: boolean;
  thin_bar: boolean;
  title_font_size: number;
  title_font_weight: number;
}

export interface IPollData extends IWidgetData {
  settings: IPollSettings;
}

@InheritMutations()
export class PollService extends WidgetSettingsService<IPollData> {
  static initialState = WIDGET_INITIAL_STATE;

  getApiSettings() {
    return {
      type: WidgetType.Poll,
      url: WidgetDefinitions[WidgetType.Poll].url(this.getHost(), this.getWidgetToken()),
      previewUrl: `https://${this.getHost()}/widgets/poll?token=${this.getWidgetToken()}&simulate=1`,
      dataFetchUrl: `https://${this.getHost()}/api/v5/slobs/widget/poll`,
      settingsSaveUrl: `https://${this.getHost()}/api/v5/slobs/widget/poll`,
      settingsUpdateEvent: 'pollSettingsUpdate',
      customCodeAllowed: true,
      customFieldsAllowed: true,
      hasTestButtons: true,
    };
  }
}
