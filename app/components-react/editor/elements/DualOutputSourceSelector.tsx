import React, { useMemo } from 'react';
import { Services } from 'components-react/service-provider';
import { useVuex } from 'components-react/hooks';
import { useModule } from 'slap';
import { SourceSelectorModule } from './SourceSelector';

interface IDualOutputSourceSelector {
  nodeId: string;
  sceneId?: string;
}
export function DualOutputSourceSelector(p: IDualOutputSourceSelector) {
  const { toggleVisibility, makeActive } = useModule(SourceSelectorModule);
  const { DualOutputService } = Services;

  const v = useVuex(() => ({
    verticalNodeId:
      DualOutputService.views.verticalNodeIds && DualOutputService.views.activeDisplays.horizontal
        ? DualOutputService.views.activeSceneNodeMap[p.nodeId]
        : p.nodeId,
    isHorizontalVisible: DualOutputService.views.getIsHorizontalVisible(p.nodeId, p?.sceneId),
    isVerticalVisible: DualOutputService.views.getIsVerticalVisible(p.nodeId, p?.sceneId),
    isLoading: DualOutputService.views.isLoading && !DualOutputService.views.hasVerticalNodes,
    horizontalActive: DualOutputService.views.activeDisplays.horizontal,
    verticalActive: DualOutputService.views.activeDisplays.vertical,
  }));

  const showHorizontalToggle = useMemo(() => {
    return !v?.isLoading && v.horizontalActive;
  }, [!v?.isLoading, v.horizontalActive]);

  const showVerticalToggle = useMemo(() => {
    return !v?.isLoading && v?.verticalNodeId && v.verticalActive;
  }, [!v?.isLoading, v?.verticalNodeId, v.verticalActive]);

  return (
    <>
      {showHorizontalToggle && (
        <i
          onClick={() => {
            toggleVisibility(p.nodeId);
            makeActive(p.nodeId);
          }}
          className={v.isHorizontalVisible ? 'icon-desktop' : 'icon-desktop-hide'}
        />
      )}

      {showVerticalToggle && (
        <i
          onClick={() => {
            toggleVisibility(v.verticalNodeId);
            makeActive(v.verticalNodeId);
          }}
          className={v.isVerticalVisible ? 'icon-phone-case' : 'icon-phone-case-hide'}
        />
      )}
    </>
  );
}
