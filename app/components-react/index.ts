/// <reference path="./index.d.ts" />
import NameFolder from './windows/NameFolder';
import NewsBanner from './root/NewsBanner';
import PerformanceMetrics from './shared/PerformanceMetrics';
import TitleBar from './shared/TitleBar';
import Chat from './root/Chat';

// list of React components for usage inside Vue components
export const components = {
  NameFolder,
  NewsBanner,
  PerformanceMetrics,
  TitleBar,
  Chat,
};
