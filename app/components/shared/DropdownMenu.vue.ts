import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import Popper from 'vue-popperjs';

@Component({
  components: { Popper }
})
export default class DropdownMenu extends Vue {

  @Prop()
  title: string;

  @Prop()
  placement: string;

  @Prop()
  icon: string;

  get getPlacement() {
    return this.placement || 'bottom-start';
  }
}
