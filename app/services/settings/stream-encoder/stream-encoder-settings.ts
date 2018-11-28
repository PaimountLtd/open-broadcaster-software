import { invert, cloneDeep } from  'lodash';
import { Service } from 'services/service';
import { SettingsService } from 'services/settings';
import { Inject } from 'util/injector';

export enum EEncoder {
  x264 = 'x264',
  qsv = 'qsv',
  nvenc = 'nvenc',
  amd = 'amd'
}

enum EObsEncoder {
  x264 = 'x264',
  obs_x264 = 'obs_x264',
  nvenc = 'nvenc',
  ffmpeg_nvenc = 'ffmpeg_nvenc',
  amd = 'amd',
  amd_amf_h264 = 'amd_amf_h264',
  qsv = 'qsv',
  obs_qsv11 = 'obs_qsv11'
}

export const QUALITY_ORDER =  [

  // x264
  'ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower',

  // NVENC
  'hp', 'fast', 'bd', 'llhp', 'default', 'll', 'llhq', 'hq', 'medium', 'slow', 'losslesshp', 'lossless',

  // QSV
  'speed', 'balanced', 'quality'
];


export interface IStreamEncoderSettings {
  mode: 'Simple' | 'Advanced';
  encoder: EEncoder;
  bitrate: number;
  inputResolution: string;
  outputResolution: string;
  preset: string;
  encoderOptions: string;
  rescaleOutput: boolean;
}

const simpleEncoderToAndancedEncoderMap = {
  'x264': 'obs_x264',
  'qsv': 'obs_qsv11',
  'nvenc': 'ffmpeg_nvenc',
  'amd': 'amd_amf_h26'
};


/**
 * each encoder have different set of fields
 */
export const encoderFieldsMap = {
  x264: { preset: 'preset', encoderOptions: 'x264opts' },
  nvenc: { preset: 'preset' },
  qsv: { preset: 'target_usage' }
};


function simpleEncoderToAdvancedEncoder(encoder: EEncoder) {
  return simpleEncoderToAndancedEncoderMap[encoder];
}

/**
 * returns a short encoder name if exists
 */
export function obsEncoderToEncoder(obsEncoder: EObsEncoder): EEncoder {
  const encoder = invert(simpleEncoderToAndancedEncoderMap)[obsEncoder] || obsEncoder;
  return encoder as EEncoder;
}

export class StreamEncoderSettingsService extends Service {
  @Inject() private settingsService: SettingsService;

  /**
   * Returns some information about the user's streaming settings.
   * This is used in aggregate to improve our optimized video encoding.
   *
   * P.S. Settings needs a refactor... badly
   */
  getSettings(): IStreamEncoderSettings {
    const output = this.settingsService.getSettingsFormData('Output');
    const video = this.settingsService.getSettingsFormData('Video');

    const mode = this.settingsService.findSettingValue(output, 'Untitled', 'Mode');
    const encoder = obsEncoderToEncoder(
      this.settingsService.findSettingValue(output, 'Streaming', 'Encoder') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'StreamEncoder')
    ) as EEncoder;
    const preset: string = this.settingsService.findSettingValue(output, 'Streaming', 'preset') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'Preset') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'NVENCPreset') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'QSVPreset') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'target_usage') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'QualityPreset') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'AMDPreset');
    const bitrate: number = this.settingsService.findSettingValue(output, 'Streaming', 'bitrate') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'VBitrate');
    const inputResolution: string = this.settingsService.findSettingValue(video, 'Untitled', 'Base');
    const outputResolution: string =
      this.settingsService.findSettingValue(output, 'Streaming', 'RescaleRes') ||
      this.settingsService.findSettingValue(video, 'Untitled', 'Output');
    const encoderOptions = this.settingsService.findSettingValue(output, 'Streaming', 'x264Settings') ||
      this.settingsService.findSettingValue(output, 'Streaming', 'x264opts')
    const rescaleOutput = this.settingsService.findSettingValue(output, 'Streaming', 'Rescale');

    return  {
      mode,
      encoder,
      preset,
      bitrate,
      inputResolution,
      outputResolution,
      encoderOptions,
      rescaleOutput
    };
  }


  setSettings(settingsPatch: Partial<IStreamEncoderSettings>) {
    if (settingsPatch.mode) this.settingsService.setSettingValue('Output', 'Mode', settingsPatch.mode);

    const currentSettings = this.getSettings();

    if (settingsPatch.encoder) {
      if (currentSettings.mode == 'Advanced') {
        this.settingsService.setSettingValue(
          'Output',
          'Encoder',
          simpleEncoderToAdvancedEncoder(settingsPatch.encoder));
      } else {
        this.settingsService.setSettingValue(
          'Output',
          'StreamEncoder',
          simpleEncoderToAdvancedEncoder(settingsPatch.encoder)
        );
      }
    }

    const encoder = settingsPatch.encoder || currentSettings.encoder;

    if (settingsPatch.outputResolution) {
      this.settingsService.setSettingValue('Video', 'Output', settingsPatch.outputResolution);
    }

    if (settingsPatch.preset) {
      this.settingsService.setSettingValue('Output', encoderFieldsMap[encoder].preset, settingsPatch.preset);
    }

    if (settingsPatch.encoderOptions && encoder == 'x264') {
      this.settingsService.setSettingValue(
        'Output',
        encoderFieldsMap[encoder].encoderOptions,
        settingsPatch.encoderOptions
      );
    }

    if (settingsPatch.rescaleOutput !== void 0) {
      this.settingsService.setSettingValue(
        'Output',
        'Rescale',
        settingsPatch.rescaleOutput
      );
    }
  }

}
