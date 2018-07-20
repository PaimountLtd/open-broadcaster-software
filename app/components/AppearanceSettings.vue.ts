import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { Inject } from '../util/injector';
import GenericForm from './shared/forms/GenericForm.vue';
import { TObsFormData } from './shared/forms/ObsInput';
import { ICustomizationServiceApi, ICustomizationSettings } from 'services/customization';

@Component({
  components: { GenericForm }
})
export default class AppearanceSettings extends Vue {

  @Inject() private customizationService: ICustomizationServiceApi;

  settingsFormData: TObsFormData = null;


  created() {
    this.settingsFormData = this.customizationService.getSettingsFormData();
  }


  saveSettings(formData: TObsFormData) {
    const settings: Partial<ICustomizationSettings> = {};
    formData.forEach(formInput => {
      settings[formInput.name] = formInput.value;
    });
    this.customizationService.setSettings(settings);
    this.settingsFormData = this.customizationService.getSettingsFormData();
  }

}
