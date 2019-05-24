import { ModifyTransformCommand } from './modify-transform';
import { Selection } from 'services/selection';

export class RotateItemsCommand extends ModifyTransformCommand {
  constructor(selection: Selection, private degrees: number) {
    super(selection);
  }

  get description() {
    return `Rotate ${this.selection.getNodes()[0].name}`;
  }

  modifyTransform() {
    this.selection.rotate(this.degrees);
  }
}
