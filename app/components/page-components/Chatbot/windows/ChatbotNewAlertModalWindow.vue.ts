import Vue from 'vue';
import { cloneDeep } from 'lodash';
import { Component, Prop } from 'vue-property-decorator';
import ChatbotAlertsBase from 'components/page-components/Chatbot/module-bases/ChatbotAlertsBase.vue';
import TextInput from 'components/shared/inputs/TextInput.vue';
import TextAreaInput from 'components/shared/inputs/TextAreaInput.vue';
import ListInput from 'components/shared/inputs/ListInput.vue';
import NumberInput from 'components/shared/inputs/NumberInput.vue';
import {
  IListMetadata,
  ITextMetadata,
  INumberMetadata,
} from 'components/shared/inputs/index';

import {
  IAlertMessage
} from 'services/chatbot/chatbot-interfaces';

interface INewAlertMetadata {
  follow: {
    newMessage: {
      message: ITextMetadata;
    };
  },
  sub: {
    newMessage: {
      tier: IListMetadata<string>;
      amount: INumberMetadata;
      message: ITextMetadata;
      is_gifted: IListMetadata<boolean>;
    }
  },
  tip: {
    newMessage: {
      amount: INumberMetadata;
      message: ITextMetadata;
    }
  },
  host: {
    newMessage: {
      amount: INumberMetadata;
      message: ITextMetadata;
    }
  },
  raid: {
    newMessage: {
      amount: INumberMetadata;
      message: ITextMetadata;
    }
  }
}

interface INewAlertData {
  follow: {
    newMessage: IAlertMessage;
  };
  sub: {
    newMessage: IAlertMessage;
  };
  tip: {
    newMessage: IAlertMessage;
  }
  host: {
    newMessage: IAlertMessage;
  }
  raid: {
    newMessage: IAlertMessage;
  }
}

@Component({
  components: {
    TextInput,
    TextAreaInput,
    ListInput,
    NumberInput
  }
})
export default class ChatbotNewAlertModalWindow extends ChatbotAlertsBase {
  @Prop() selectedType: string;

  onSubmitHandler: Function = () => {};

  newAlert: INewAlertData = cloneDeep(this.initialNewAlertState);

  get title() {
    return `New ${this.selectedType} Alert`;
  }

  get isDonation() {
    return this.selectedType === 'tip';
  }

  get isSubscription() {
    return this.selectedType === 'sub';
  }

  get isFollower() {
    return this.selectedType === 'follow';
  }

  get isHost() {
    return this.selectedType === 'host';
  }

  get isRaid() {
    return this.selectedType === 'raid';
  }

  get metadata() {
    const metadata: INewAlertMetadata = {
      follow: {
        newMessage: {
          message: {
            required: true,
            placeholder: 'Message to follower'
          }
        }
      },
      sub: {
        newMessage: {
          tier: {
            required: true,
            options: ['Prime', 'Tier 1', 'Tier 2', 'Tier 3'].map(tier => ({
              value: tier,
              title: tier
            }))
          },
          amount: {
            required: true,
            placeholder: 'Number of months subscribed'
          },
          message: {
            required: true,
            placeholder: 'Message to subscriber'
          },
          is_gifted: {
            required: true,
            options: ['yes', 'no'].map(isGifted => ({
              value: isGifted === 'yes',
              title: isGifted
            }))
          }
        }
      },
      tip: {
        newMessage: {
          amount: {
            min: 0,
            placeholder: 'Minimum amount'
          },
          message: {
            required: true,
            placeholder: 'Message to donator'
          }
        }
      },
      host: {
        newMessage: {
          amount: {
            min: 0,
            placeholder: 'Minimum viewer count'
          },
          message: {
            required: true,
            placeholder: 'Message to hosts'
          }
        }
      },
      raid: {
        newMessage: {
          amount: {
            min: 0,
            placeholder: 'Minimum amount'
          },
          message: {
            required: true,
            placeholder: 'Message to raider'
          }
        }
      }
    };
    return metadata;
  }

  get initialNewAlertState() {
    const initialState: INewAlertData = {
      follow: {
        newMessage: {
          message: null
        }
      },
      sub: {
        newMessage: {
          amount: null,
          message: null,
          is_gifted: false,
          tier: 'Prime'
        }
      },
      tip: {
        newMessage: {
          amount: null,
          message: null
        }
      },
      host: {
        newMessage: {
          amount: null,
          message: null
        }
      },
      raid: {
        newMessage: {
          amount: null,
          message: null
        }
      }
    };
    return initialState;
  }

  bindOnSubmitAndCheckIfEdited(event: any) {
    const { onSubmitHandler, editedAlert } = event.params;
    this.onSubmitHandler = onSubmitHandler;
    if (editedAlert) {
      this.newAlert[this.selectedType].newMessage = cloneDeep(editedAlert);
    } else {
      this.newAlert = cloneDeep(this.initialNewAlertState);
    }
  }

  cancel() {
    this.$modal.hide('new-alert');
  }

  submit() {
    this.onSubmitHandler(this.newAlert[this.selectedType].newMessage);
  }
}