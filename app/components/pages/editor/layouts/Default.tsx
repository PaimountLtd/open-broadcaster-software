import cx from 'classnames';
import TsxComponent, { createProps } from 'components/tsx-component';
import { Component } from 'vue-property-decorator';
import ResizeBar from 'components/shared/ResizeBar.vue';
import styles from './Layouts.m.less';

export class LayoutProps {
  resizeStartHandler: () => void = () => {};
  resizeStopHandler: () => void = () => {};
  reconcileSizeWithinContraints: (mins: IResizeMins, isBar2Resize?: boolean) => void = () => {};
  setBarResize: (bar: 'bar1' | 'bar2', size: number) => void = () => {};
  resizes: { bar1: number; bar2: number } = null;
  max: number = null;
}

// the minimums here represent the asbolute minimum of a viable component (minimized to invisibility)
// and the reasonable minimum of a still usable component
export interface IResizeMins {
  bar1: { absolute: number; reasonable: number };
  bar2: { absolute: number; reasonable: number };
}

const RESIZE_MINS = {
  bar1: { absolute: 32, reasonable: 156 },
  bar2: { absolute: 50, reasonable: 150 },
};

@Component({ props: createProps(LayoutProps) })
export default class Default extends TsxComponent<LayoutProps> {
  mounted() {
    this.props.reconcileSizeWithinContraints(RESIZE_MINS);
    window.addEventListener('resize', this.windowResizeHandler);
  }
  destroyed() {
    window.removeEventListener('resize', this.windowResizeHandler);
  }

  windowResizeHandler() {
    this.props.reconcileSizeWithinContraints(RESIZE_MINS);
  }

  get bar1() {
    return this.props.resizes.bar1;
  }
  set bar1(size: number) {
    if (size === 0) return;
    this.props.setBarResize('bar1', size);
    this.props.reconcileSizeWithinContraints(RESIZE_MINS);
  }

  get bar2() {
    return this.props.resizes.bar2;
  }
  set bar2(size: number) {
    this.props.setBarResize('bar2', size);
    this.props.reconcileSizeWithinContraints(RESIZE_MINS, true);
  }

  render() {
    return (
      <div class={styles.rows}>
        <div style={{ height: `calc(100% - ${this.bar1 + this.bar2}px)` }}>{this.$slots['1']}</div>
        <ResizeBar
          position="top"
          vModel={this.bar1}
          onResizestart={() => this.props.resizeStartHandler()}
          onResizestop={() => this.props.resizeStopHandler()}
          max={this.props.max - this.bar2}
          min={32}
          reverse={true}
        />
        <div style={{ height: `${this.bar1}px` }} class={cx(styles.cell, styles.noTopPadding)}>
          {this.$slots['2']}
        </div>
        <ResizeBar
          position="top"
          vModel={this.bar2}
          onResizestart={() => this.props.resizeStartHandler()}
          onResizestop={() => this.props.resizeStopHandler()}
          max={this.props.max}
          min={50}
          reverse={true}
        />
        <div class={styles.segmented} style={{ height: `${this.bar2}px`, padding: '0 8px' }}>
          <div class={cx(styles.cell, styles.noTopPadding)}>{this.$slots['3']}</div>
          <div class={cx(styles.cell, styles.noTopPadding)}>{this.$slots['4']}</div>
          <div class={cx(styles.cell, styles.noTopPadding)}>{this.$slots['5']}</div>
        </div>
      </div>
    );
  }
}
