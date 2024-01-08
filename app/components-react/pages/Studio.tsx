import React, { ReactNode, useMemo } from 'react';
import cx from 'classnames';
import { ELayoutElement, IVec2Array } from 'services/layout';
import * as elements from 'components-react/editor/elements';
import * as layouts from 'components-react/editor/layouts';
import { Services } from 'components-react/service-provider';
import { useVuex } from 'components-react/hooks';

export default function Studio(p: { onTotalWidth: (width: Number) => void; className?: string }) {
  const { LayoutService } = Services;

  function totalWidthHandler(slots: IVec2Array, isColumns: boolean) {
    if (isColumns) {
      p.onTotalWidth(LayoutService.views.calculateColumnTotal(slots));
    } else {
      p.onTotalWidth(LayoutService.views.calculateMinimum('x', slots));
    }
  }

  const { elementsToRender, slottedElements } = useVuex(() => ({
    elementsToRender: LayoutService.views.elementsToRender,
    slottedElements: LayoutService.views.currentTab.slottedElements,
  }));

  const Layout = layouts[LayoutService.views.component];

  const { children, childrenMins } = useMemo(() => {
    const children: Dictionary<ReactNode> = {};
    const childrenMins: Dictionary<IVec2> = {};
    elementsToRender.forEach((el: ELayoutElement) => {
      const componentName = LayoutService.views.elementComponent(el);
      const Component = elements[componentName];
      const slot = slottedElements[el]?.slot;
      if (slot && Component) {
        children[slot] = <Component />;
        childrenMins[slot] = Component.mins;
      }
    });
    return { children, childrenMins };
  }, []);

  return (
    <Layout
      className={cx('editor-page', p.className)}
      childrenMins={childrenMins}
      onTotalWidth={(slots: IVec2Array, isColumns: boolean) => totalWidthHandler(slots, isColumns)}
    >
      {children}
    </Layout>
  );
}
