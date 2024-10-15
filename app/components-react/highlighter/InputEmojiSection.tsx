import React from 'react';
import { TClip } from 'services/highlighter';
import { isAiClip } from './utils';
import { EHighlighterInputTypes } from 'services/highlighter/ai-highlighter/ai-highlighter';

export function InputEmojiSection({
  clips,
  includeRounds,
  includeDeploy,
}: {
  clips: TClip[];
  includeRounds: boolean;
  includeDeploy: boolean;
}): JSX.Element {
  const inputTypeMap = Object.entries(getMomentTypeCount(clips));
  const filteredinputTypeMap =
    inputTypeMap.length > 2 || includeDeploy === false
      ? inputTypeMap.filter(([type]) => type !== 'deploy')
      : inputTypeMap;
  const manualClips = clips.filter(
    clip => clip.source === 'ReplayBuffer' || clip.source === 'Manual',
  );
  const rounds = getAmountOfRounds(clips);
  function manualClip() {
    if (manualClips.length === 0) {
      return <></>;
    }
    return (
      <div key={'manualClips'} style={{ display: 'flex', gap: '4px' }}>
        <span>🎬</span>
        <span>{`${manualClips.length} ${manualClips.length === 1 ? 'manual' : 'manuals'}`}</span>
      </div>
    );
  }

  return (
    <div style={{ height: '22px', display: 'flex', gap: '8px' }}>
      {includeRounds && (
        <div key={'rounds'} style={{ display: 'flex', gap: '4px' }}>
          <span key={'rounds' + 'emoji'}> {getTypeWordingFromType('rounds', rounds).emoji} </span>{' '}
          <span key={'rounds' + 'desc'}>
            {rounds} {getTypeWordingFromType('rounds', rounds).description}
          </span>
        </div>
      )}
      {filteredinputTypeMap.map(([type, count]) => (
        <div key={type} style={{ display: 'flex', gap: '4px' }}>
          <span key={type + 'emoji'}>{getTypeWordingFromType(type, count).emoji} </span>{' '}
          <span key={type + 'desc'}>
            {count} {getTypeWordingFromType(type, count).description}
          </span>
        </div>
      ))}
      {manualClip()}
      {inputTypeMap.length > 3 ? '...' : ''}
    </div>
  );
}

function getTypeWordingFromType(
  type: string,
  count: number,
): { emoji: string; description: string } {
  switch (type) {
    case EHighlighterInputTypes.KILL:
      return { emoji: '💀', description: count > 1 ? 'eliminations' : 'elimination' };
    case EHighlighterInputTypes.KNOCKED:
      return { emoji: '🥊', description: count > 1 ? 'knockeds' : 'knocked' };
    case EHighlighterInputTypes.DEATH:
      return { emoji: '🪦', description: count > 1 ? 'deaths' : 'death' };
    case EHighlighterInputTypes.VICTORY:
      return { emoji: '🏆', description: count > 1 ? 'wins' : 'win' };
    case EHighlighterInputTypes.DEPLOY:
      return { emoji: '🪂', description: count > 1 ? 'deploys' : 'deploy' };
    case 'rounds':
      return { emoji: '🏁', description: count > 1 ? 'rounds' : 'round' };
    default:
      break;
  }
  return { emoji: type, description: count > 1 ? `${type}s` : type };
}

function getMomentTypeCount(clips: TClip[]): { [type: string]: number } {
  const typeCounts: { [type: string]: number } = {};
  clips.forEach(clip => {
    if (isAiClip(clip)) {
      clip.aiInfo.moments.forEach(moment => {
        const type = moment.type;
        if (typeCounts[type]) {
          typeCounts[type] += 1;
        } else {
          typeCounts[type] = 1;
        }
      });
    }
  });
  return typeCounts;
}

function getAmountOfRounds(clips: TClip[]): number {
  const rounds: number[] = [];
  clips.filter(isAiClip).forEach(clip => {
    rounds.push(clip.aiInfo.metadata?.round || 1);
  });
  return Math.max(...rounds);
}
