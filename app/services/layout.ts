import { PersistentStatefulService } from 'services/core/persistent-stateful-service';
import { mutation } from 'services/core/stateful-service';

export enum ELayout {
  Default = 'Default',
  TwoPane = 'TwoPane',
}

export enum ELayoutElement {
  Minifeed = 'Minifeed',
  LegacyEvents = 'LegacyEvents',
  Display = 'Display',
  Mixer = 'Mixer',
  Scenes = 'Scenes',
  Sources = 'Sources',
}

interface ILayoutServiceState {
  currentLayout: ELayout;
  slottedWidgets: { [key in ELayoutElement]?: '1' | '2' | '3' | '4' | '5' | '6' };
  resizes: { bar1: number; bar2: number };
}

const RESIZE_DEFAULTS = {
  [ELayout.Default]: {
    bar1: 156,
    bar2: 240,
  },
  [ELayout.TwoPane]: {
    bar1: 650,
    bar2: 300,
  },
};

export class LayoutService extends PersistentStatefulService<ILayoutServiceState> {
  static defaultState: ILayoutServiceState = {
    currentLayout: ELayout.Default,
    slottedWidgets: {
      Display: '1',
      Minifeed: '2',
      Scenes: '3',
      Sources: '4',
      Mixer: '5',
    },
    resizes: {
      bar1: 156,
      bar2: 240,
    },
  };

  init() {
    super.init();
  }

  setBarResize(bar: 'bar1' | 'bar2', size: number) {
    this.SET_RESIZE(bar, size);
  }

  unslottedElements() {
    return Object.keys(ELayoutElement).filter(
      el => !this.state.slottedWidgets[el],
    ) as ELayoutElement[];
  }

  @mutation()
  CHANGE_LAYOUT(layout: ELayout) {
    this.state.currentLayout = layout;
    this.state.slottedWidgets = {};
    this.state.resizes = RESIZE_DEFAULTS[layout];
  }

  @mutation()
  SLOT_ELEMENT(element: ELayoutElement, slot: '1' | '2' | '3' | '4' | '5' | '6') {
    this.state.slottedWidgets[element] = slot;
  }

  @mutation()
  SET_RESIZE(bar: 'bar1' | 'bar2', size: number) {
    this.state.resizes[bar] = size;
  }
}
