import moment from 'moment';
import { IAiClip, TClip } from 'services/highlighter';

export const isAiClip = (clip: TClip): clip is IAiClip => clip.source === 'AiClip';

export function groupStreamsByTimePeriod(streams: { id: string; date: string }[]) {
  const now = moment();
  const groups: { [key: string]: typeof streams } = {
    Today: [],
    Yesterday: [],
    'This week': [],
    'Last week': [],
    'This month': [],
    'Last month': [],
  };
  const monthGroups: { [key: string]: typeof streams } = {};

  streams.forEach(stream => {
    const streamDate = moment(stream.date);
    if (streamDate.isSame(now, 'day')) {
      groups['Today'].push(stream);
    } else if (streamDate.isSame(now.clone().subtract(1, 'day'), 'day')) {
      groups['Yesterday'].push(stream);
    } else if (streamDate.isSame(now, 'week')) {
      groups['This week'].push(stream);
    } else if (streamDate.isSame(now.clone().subtract(1, 'week'), 'week')) {
      groups['Last week'].push(stream);
    } else if (streamDate.isSame(now, 'month')) {
      groups['This month'].push(stream);
    } else if (streamDate.isSame(now.clone().subtract(1, 'month'), 'month')) {
      groups['Last month'].push(stream);
    } else {
      const monthKey = streamDate.format('MMMM YYYY');
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(stream);
    }
  });

  return { ...groups, ...monthGroups };
}

export function sortClips(clips: TClip[], streamId: string | undefined): TClip[] {
  let sortedClips;

  if (streamId) {
    const clipsWithOrder = clips
      .filter(c => c.streamInfo?.[streamId]?.orderPosition !== undefined && c.deleted !== true)
      .sort(
        (a: TClip, b: TClip) =>
          a.streamInfo![streamId]!.orderPosition - b.streamInfo![streamId]!.orderPosition,
      );

    const clipsWithOutOrder = clips.filter(
      c =>
        (c.streamInfo === undefined ||
          c.streamInfo[streamId] === undefined ||
          c.streamInfo[streamId]?.orderPosition === undefined) &&
        c.deleted !== true,
    );

    sortedClips = [...clipsWithOrder, ...clipsWithOutOrder];
  } else {
    sortedClips = clips
      .filter(c => c.deleted !== true)
      .sort((a: TClip, b: TClip) => a.globalOrderPosition - b.globalOrderPosition);
  }

  return sortedClips;
}

export function clipsToStringArray(clips: TClip[]): { id: string }[] {
  return clips.map(c => ({ id: c.path }));
}

export function createFinalSortedArray(
  newOrderOfSomeItems: string[],
  allItemArray: string[],
): string[] {
  const finalArray: (string | null)[] = new Array(allItemArray.length).fill(null);
  const itemsNotInNewOrder = allItemArray.filter(item => !newOrderOfSomeItems.includes(item));

  itemsNotInNewOrder.forEach(item => {
    const index = allItemArray.indexOf(item);
    finalArray[index] = item;
  });

  let newOrderIndex = 0;
  for (let i = 0; i < finalArray.length; i++) {
    if (finalArray[i] === null) {
      finalArray[i] = newOrderOfSomeItems[newOrderIndex];
      newOrderIndex++;
    }
  }

  return finalArray.filter((item): item is string => item !== null);
}

export function filterClips(clips: TClip[], filter: string) {
  return clips.filter(clip => {
    switch (filter) {
      case 'ai':
        return clip.source === 'AiClip';
      case 'manual':
        return clip.source === 'Manual' || clip.source === 'ReplayBuffer';
      case 'all':
      default:
        return true;
    }
  });
}
export function sortAndFilterClips(clips: TClip[], streamId: string | undefined, filter: string) {
  const sortedClips = sortClips(clips, streamId);
  const filteredClips = filterClips(sortedClips, filter);
  const sorted = sortedClips.map(clip => ({ id: clip.path }));
  const sortedFiltered = filteredClips.map(clip => ({
    id: clip.path,
  }));

  return { sorted, sortedFiltered };
}
