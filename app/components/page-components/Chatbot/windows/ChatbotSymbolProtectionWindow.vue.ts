import { Component, Prop } from 'vue-property-decorator';
import ChatbotModToolsBase from 'components/page-components/Chatbot/module-bases/ChatbotModToolsBase.vue';
import { $t } from 'services/i18n';
import { ITab } from 'components/Tabs.vue';

@Component({})
export default class ChatbotSymbolProtectionWindow extends ChatbotModToolsBase {
  tabs: ITab[] = [
    {
      name: $t('General'),
      value: 'general'
    },
    {
      name: $t('Advanced'),
      value: 'advanced'
    }
  ];

  selectedTab: string = 'general';

  onSelectTabHandler(tab: string) {
    this.selectedTab = tab;
  }

  onResetHandler() {
    this.onResetSlugHandler('symbol-protection');
  }

  onSaveHandler() {
    this.chatbotApiService
      .updateSymbolProtection({
        enabled: this.symbolProtectionResponse.enabled,
        settings: this.symbolProtection
      })
      .then(() => {
        this.chatbotCommonService.closeChildWindow();
      });
  }
}
