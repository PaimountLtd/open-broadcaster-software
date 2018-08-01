import { Component } from 'vue-property-decorator';
import ChatbotBase from 'components/page-components/Chatbot/ChatbotBase.vue';
import ChatbotModule from 'components/page-components/Chatbot/Modules/ChatbotModule.vue';

import {
  IChatbotModule,
  IChatAlertsResponse
} from 'services/chatbot/chatbot-interfaces';

@Component({
  components: {
    ChatbotModule
  }
})
export default class ChatbotModTools extends ChatbotBase {
  mounted() {
    this.chatbotApiService.fetchCapsProtection();
    this.chatbotApiService.fetchSymbolProtection();
    this.chatbotApiService.fetchLinkProtection();
    this.chatbotApiService.fetchWordProtection();
  }

  get modules() {
    let modules: IChatbotModule[] = [
      {
        title: 'Caps Protection',
        description: 'Restrict viewers from spamming all caps messages to chat.',
        backgroundUrl: require('../../../../media/images/chatbot/chatbot-caps-protection.png'),
        enabled: this.capsProtectionCurrentlyEnabled,
        onExpand: () => {
          this.chatbotCommonService.openCapsProtectionWindow();
        },
        onToggleEnabled: () => {
          this.chatbotApiService.updateCapsProtection({
            ...this.capsProtection,
            enabled: !this.capsProtectionCurrentlyEnabled
          });
        }
      },
      {
        title: 'Symbol Protection',
        description: 'Restrict viewers from spamming messages with too many symbols.',
        backgroundUrl: require('../../../../media/images/chatbot/chatbot-symbol-protection.png'),
        enabled: this.symbolProtectionCurrentlyEnabled,
        onExpand: () => {
          this.chatbotCommonService.openChatbotAlertsWindow();
        },
        onToggleEnabled: () => {
          this.chatbotApiService.updateSymbolProtection({
            ...this.symbolProtection,
            enabled: !this.symbolProtectionCurrentlyEnabled
          });
        }
      },
      {
        title: 'Link Protection',
        description: 'Allows a viewer to only send links to chat from websites on the whitelist.',
        backgroundUrl: require('../../../../media/images/chatbot/chatbot-link-protection.png'),
        enabled: this.linkProtectionCurrentlyEnabled,
        onExpand: () => {
          this.chatbotCommonService.openChatbotAlertsWindow();
        },
        onToggleEnabled: () => {
          this.chatbotApiService.updateLinkProtection({
            ...this.linkProtection,
            enabled: !this.linkProtectionCurrentlyEnabled
          });
        }
      },
      {
        title: 'Word Protection',
        description: 'Restrict words from appearing on chat and add words to your blacklist.',
        backgroundUrl: require('../../../../media/images/chatbot/chatbot-word-protection.png'),
        enabled: this.wordProtectionCurrentlyEnabled,
        onExpand: () => {
          this.chatbotCommonService.openChatbotAlertsWindow();
        },
        onToggleEnabled: () => {
          this.chatbotApiService.updateWordProtection({
            ...this.wordProtection,
            enabled: !this.wordProtectionCurrentlyEnabled
          });
        }
      }
    ];
    return modules;
  }

  get capsProtection() {
    return this.chatbotApiService.state.capsProtectionResponse;
  }

  get symbolProtection() {
    return this.chatbotApiService.state.symbolProtectionResponse;
  }

  get linkProtection() {
    return this.chatbotApiService.state.linkProtectionResponse;
  }

  get wordProtection() {
    return this.chatbotApiService.state.wordProtectionResponse;
  }

  get capsProtectionCurrentlyEnabled() {
    return this.capsProtection.enabled == true;
  }

  get symbolProtectionCurrentlyEnabled() {
    return this.symbolProtection.enabled == true;
  }

  get linkProtectionCurrentlyEnabled() {
    return this.linkProtection.enabled == true;
  }

  get wordProtectionCurrentlyEnabled() {
    return this.wordProtection.enabled == true;
  }

}
