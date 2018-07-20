import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { Inject } from 'util/injector';
import { TransitionsService, ETransitionType } from 'services/transitions';
import * as inputComponents from 'components/shared/forms';
import { TObsFormData, IObsListInput, IObsInput } from 'components/shared/forms/ObsInput';
import GenericForm from 'components/shared/forms/GenericForm.vue';
import { $t } from 'services/i18n';

@Component({
  components: {
    GenericForm,
    ...inputComponents
  }
})
export default class SceneTransitions extends Vue {
  @Inject() transitionsService: TransitionsService;

  @Prop() transitionId: string;

  get typeModel(): IObsListInput<ETransitionType> {
    return {
      description: $t('Type'),
      name: 'type',
      value: this.transition.type,
      options: this.transitionsService.getTypes()
    };
  }

  set typeModel(model: IObsListInput<ETransitionType>) {
    this.transitionsService.changeTransitionType(this.transitionId, model.value);
    this.properties = this.transitionsService.getPropertiesFormData(this.transitionId);
  }

  get durationModel(): IObsInput<number> {
    return {
      description: $t('Duration'),
      name: 'duration',
      value: this.transition.duration
    };
  }

  set durationModel(model: IObsInput<number>) {
    this.transitionsService.setDuration(this.transitionId, model.value);
  }

  get nameModel(): IObsInput<string> {
    return {
      description: $t('Name'),
      name: 'name',
      value: this.transition.name
    };
  }

  set nameModel(name: IObsInput<string>) {
    this.transitionsService.renameTransition(this.transitionId, name.value);
  }

  get transition() {
    return this.transitionsService.getTransition(this.transitionId);
  }

  properties = this.transitionsService.getPropertiesFormData(this.transitionId);

  saveProperties(props: TObsFormData) {
    this.transitionsService.setPropertiesFormData(this.transitionId, props);
  }
}
