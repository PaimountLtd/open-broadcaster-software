import { Component, Prop } from 'vue-property-decorator';
import { Multiselect } from 'vue-multiselect';
import { EInputType, IInputMetadata } from './index';
import { BaseInput } from './BaseInput';
import FormInput from './FormInput.vue';


@Component({
  components: { FormInput }
})

export default class FormGroup extends BaseInput<any, IInputMetadata> {

  @Prop()
  type: EInputType;

  @Prop()
  value: undefined;

  @Prop()
  metadata: IInputMetadata;

  @Prop()
  title: string;

  get formInputMetadata() {
    const options = this.options;
    if (!options.type) return {};
    const inputMetadata = options;

    // FormGroup handle the render of the FormInput title
    // so remove the title from FormInput metadata
    delete inputMetadata.title;
    return inputMetadata;
  }

  getOptions() {
    const options = super.getOptions();
    options.type = this.type || options.type;
    options.title = this.title || options.title;
    return options;
  }

}
