import { mutation, StatefulService } from 'services/core/stateful-service';
import { Inject } from 'services/core/injector';
import { NicoliveProgramStateService, SynthesizerId } from './state';
import { ParaphraseDictionary } from './ParaphraseDictionary';
import { WrappedChat } from './WrappedChat';
import { getDisplayText } from './ChatMessage/displaytext';
import { AddComponent } from './ChatMessage/ChatComponentType';
import { NVoiceClientService } from './n-voice-client';

export type Speech = {
  text: string;
  synthesizer: SynthesizerId;
  pitch?: number;
  webSpeech?: {
    rate: number;
  },
  volume?: number;
  nVoice?: {
    maxTime: number;
  }
};

interface ICommentSynthesizerState {
  enabled: boolean;
  pitch: number; // SpeechSynthesisUtterance.pitch; 0.1(lowest) to 2(highest) (default: 1)
  rate: number; // SpeechSynthesisUtterence.rate; 0.1(lowest) to 10(highest); default:1, only for web speech
  volume: number; // SpeechSynthesisUtterance.volume; 0.1(lowest) to 1(highest)
  maxTime: number; // nVoice max time in seconds
  selector: {
    normal: SynthesizerId;
    operator: SynthesizerId;
    system: SynthesizerId;
  };
}

export class NicoliveCommentSynthesizerService extends StatefulService<ICommentSynthesizerState> {
  @Inject('NicoliveProgramStateService') stateService: NicoliveProgramStateService;
  @Inject() nVoiceClientService: NVoiceClientService;

  static initialState: ICommentSynthesizerState = {
    enabled: true,
    pitch: 1,
    rate: 1,
    volume: 1,
    maxTime: 4,
    selector: {
      normal: 'nVoice',
      operator: 'webSpeech',
      system: 'webSpeech',
    }
  };

  // delegate synth
  webSpeech = new WebSpeechSynthesizer();
  nVoice: NVoiceSynthesizer;
  getSynthesizer(id: SynthesizerId): ISpeechSynthesizer | null {
    switch (id) {
      case 'webSpeech':
        return this.webSpeech;
      case 'nVoice':
        return this.nVoice;
      default:
        return null;
    }
  }

  currentPlayingId: SynthesizerId | null = null;
  currentPlaying(): ISpeechSynthesizer | null {
    return this.currentPlaying ? this.getSynthesizer(this.currentPlayingId) : null;
  }

  init(): void {
    /*
    // 後から追加された属性がなければ追加する
    if (this.state.selector === undefined || this.state.maxTime === undefined) {
      console.log('NicoliveCommentSynthesizerService: init', this.state); // DEBUG
      this.SET_STATE({
        ...NicoliveCommentSynthesizerService.initialState.selector,
        ...this.state,
      });
    }
    */
    this.stateService.updated.subscribe({
      next: persistentState => {
        const newState =
          {
            ...NicoliveCommentSynthesizerService.initialState,
            ...persistentState.speechSynthesizerSettings
          } ||
          NicoliveCommentSynthesizerService.initialState;
        this.SET_STATE(newState);
      },
    });
    this.nVoice = new NVoiceSynthesizer(this.nVoiceClientService);
  }

  private dictionary = new ParaphraseDictionary();

  makeSpeechText(chat: WrappedChat, engine: 'webSpeech' | 'nVoice'): string {
    if (!chat.value || !chat.value.content) {
      return '';
    }
    const text = getDisplayText(AddComponent(chat));

    const converted = this.dictionary.process(text, engine);

    return converted;
  }

  private selectSpeechSynthesizer(chat: WrappedChat): SynthesizerId {
    switch (chat.type) {
      case 'normal':
        return this.state.selector.normal;
      case 'operator':
        return 'nVoice'; // this.state.selector.operator; // DEBUG
      default:
        return this.state.selector.system;
    }
  }

  makeSpeech(chat: WrappedChat, synthId?: SynthesizerId): Speech | null {
    const synthesizer = synthId || this.selectSpeechSynthesizer(chat);

    const r = this.makeSpeechText(chat, synthesizer);
    if (r === '') {
      return null;
    }
    return {
      pitch: this.state.pitch,
      synthesizer,
      volume: this.state.volume,
      webSpeech: {
        rate: this.state.rate,
      },
      nVoice: {
        maxTime: this.state.maxTime,
      },
      text: r,
    };
  }

  makeSimpleTextSpeech(text: string, synthId?: SynthesizerId): Speech | null {
    return this.makeSpeech({
      type: 'normal',
      value: {
        content: text,
      },
      seqId: 1,
    }, synthId);
  }

  async speakText(
    speech: Speech,
    onstart: () => void,
    onend: () => void,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const toPlay = speech.synthesizer;
    const toPlaySynth = this.getSynthesizer(toPlay);

    if (this.currentPlayingId !== null) {
      if (this.currentPlayingId !== toPlay) {
        this.currentPlaying()?.waitForSpeakEnd();
      }
    }

    this.currentPlayingId = toPlay;
    toPlaySynth.speakText(speech, () => {
      onstart();
      this.currentPlayingId = toPlay;
    }, () => {
      this.currentPlayingId = null;
      onend();
    });
  }

  get speaking(): boolean {
    return this.currentPlaying()?.speaking || false;
  }

  cancelSpeak() {
    this.currentPlaying()?.cancelSpeak();
  }
  private setEnabled(enabled: boolean) {
    this.setState({ enabled });
  }
  get enabled(): boolean {
    return this.state.enabled;
  }
  set enabled(e: boolean) {
    this.setEnabled(e);
  }

  private setPitch(pitch: number) {
    this.setState({ pitch });
  }
  get pitch(): number {
    return this.state.pitch;
  }
  set pitch(p: number) {
    this.setPitch(p);
  }

  private setRate(rate: number) {
    this.setState({ rate });
  }
  get rate(): number {
    return this.state.rate;
  }
  set rate(r: number) {
    this.setRate(r);
  }

  private setVolume(volume: number) {
    this.setState({ volume });
  }
  get volume(): number {
    return this.state.volume;
  }
  set volume(r: number) {
    this.setVolume(r);
  }

  private setMaxTime(maxTime: number) {
    this.setState({ maxTime });
  }
  get maxTime(): number {
    return this.state.maxTime || 4;
  }
  set maxTime(m: number) {
    this.setMaxTime(m);
  }

  // TODO selector accessor

  private setState(partialState: Partial<ICommentSynthesizerState>) {
    const nextState = { ...this.state, ...partialState };
    this.stateService.updateSpeechSynthesizerSettings(nextState);
  }

  @mutation()
  private SET_STATE(nextState: ICommentSynthesizerState): void {
    this.state = nextState;
  }

}

export interface ISpeechSynthesizer {
  speakText(speech: Speech, onstart: () => void, onend: () => void): void;
  speaking: boolean;
  cancelSpeak(): void;
  waitForSpeakEnd(): Promise<void>;
}

export class WebSpeechSynthesizer implements ISpeechSynthesizer {
  get available(): boolean {
    return window.speechSynthesis !== undefined;
  }

  private speakingPromise: Promise<void> | null = null;
  private speakingResolve: () => void | null = null;
  private speakingCounter: number = 0;

  speakText(
    speech: Speech,
    onstart: () => void,
    onend: () => void,
  ) {
    if (!speech || speech.text === '' || !this.available) {
      return;
    }
    if (!this.speakingPromise) {
      this.speakingPromise = new Promise((resolve) => {
        this.speakingResolve = resolve;
      });
    }

    const uttr = new SpeechSynthesisUtterance(speech.text);
    uttr.pitch = speech.pitch || 1;
    uttr.rate = speech.webSpeech?.rate || 1;
    uttr.volume = speech.volume || 1;
    uttr.onstart = onstart;
    uttr.onend = () => {
      if (--this.speakingCounter === 0) {
        this.speakingResolve();
        this.speakingPromise = null;
        this.speakingResolve = null;
      }
      onend();
    }
    speechSynthesis.speak(uttr);
    this.speakingCounter++;
  }

  get speaking(): boolean {
    return this.available && speechSynthesis.speaking;
  }

  async waitForSpeakEnd(): Promise<void> {
    if (!this.speakingPromise) {
      return;
    }
    return this.speakingPromise;
  }

  cancelSpeak() {
    if (!this.available) {
      return;
    }
    speechSynthesis.cancel();
  }
}


export class NVoiceSynthesizer implements ISpeechSynthesizer {
  constructor(private nVoiceClientService: NVoiceClientService) { }

  private _cancel: () => void | undefined;
  private _playPromise: Promise<void> | undefined;

  async speakText(
    speech: Speech,
    onstart: () => void,
    onend: () => void,
  ) {
    if (!speech || speech.text === '') {
      return;
    }

    if (this._playPromise) {
      await this._playPromise;
    }
    this._playPromise = this.nVoiceClientService.talk(speech.text, {
      speed: speech.pitch,
      volume: speech.volume,
      maxTime: speech.nVoice.maxTime,
      phonemeCallback: (phoneme: string) => {
        console.log(phoneme); // DEBUG
      },
    }).then(async ({ cancel, speaking }) => {
      this._cancel = cancel;
      onstart();
      await speaking;
      this._cancel = undefined;
      onend();
      this._playPromise = undefined;
    });
  }

  get speaking(): boolean {
    return this._cancel !== undefined;
  }

  async waitForSpeakEnd(): Promise<void> {
    if (this._playPromise) {
      await this._playPromise;
    }
  }

  cancelSpeak() {
    if (this._cancel) {
      this._cancel();
    }
  }
}
