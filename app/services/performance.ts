import Vue from 'vue';
import { Subject } from 'rxjs/Subject';

import { StatefulService, mutation } from './stateful-service';
import { nodeObs } from './obs-api';

interface IPerformanceState {
  CPU: number;
  numberDroppedFrames: number;
  percentageDroppedFrames: number;
  bandwidth: number;
  frameRate: number;
}

// TODO: merge this service with PerformanceMonitorService

// Keeps a store of up-to-date performance metrics
export class PerformanceService extends StatefulService<IPerformanceState> {

  static initialState: IPerformanceState = {
    CPU: 0,
    numberDroppedFrames: 0,
    percentageDroppedFrames: 0,
    bandwidth: 0,
    frameRate: 0
  };

  droppedFramesDetected = new Subject<number>();

  @mutation()
  SET_PERFORMANCE_STATS(stats: IPerformanceState) {
    Object.keys(stats).forEach(stat => {
      Vue.set(this.state, stat, stats[stat]);
    });
  }

  init() {
    setInterval(() => {
      const stats: IPerformanceState = nodeObs.OBS_API_getPerformanceStatistics();
      if (stats.percentageDroppedFrames) {
        this.droppedFramesDetected.next(stats.percentageDroppedFrames / 100);
      }
      this.SET_PERFORMANCE_STATS(stats);
    }, 2 * 1000);
  }

}
