import electron from 'electron';
import * as obs from '../../../obs-api';
import { execSync } from 'child_process';
import { mutation, StatefulService } from '../stateful-service';
import { Inject } from '../../util/injector';
import { HostsService } from '../hosts';
import { InitAfter } from '../../util/service-observer';
import { downloadFile, handleErrors } from '../../util/requests';
import { AppService } from 'services/app';
import { SceneCollectionsService } from 'services/scene-collections';

interface IBrandDeviceUrls {
  system_sku: string;
  basic_ini_url: string;
  global_ini_url: string;
  stream_encoder_url: string;
  record_encoder_url: string;
  overlay_url: string;
  name: string;
}

interface IMsSystemInfo {
  SystemManufacturer: string;
  SystemProductName: string;
  SystemSKU: string;
  SystemVersion: string;
}

interface IBrandDeviceState extends IMsSystemInfo {
  urls: IBrandDeviceUrls;
}

@InitAfter('OnboardingService')
export class BrandDeviceService extends StatefulService<IBrandDeviceState> {

  static initialState: IBrandDeviceState = {
    SystemSKU: '',
    SystemManufacturer: '',
    SystemProductName: '',
    SystemVersion: '',
    urls: null
  };

  @Inject() private hostsService: HostsService;
  @Inject() private appService: AppService;
  @Inject() private sceneCollectionsService: SceneCollectionsService;


  serviceEnabled() {
    return true;
  }


  /**
   * fetch SystemInformation and download configuration links if we have ones
   */
  async fetchDeviceInfo() {
    if (!this.serviceEnabled()) return;

    // fetch system info via PowerShell
    const msSystemInformation = execSync('Powershell gwmi -namespace root\\wmi -class MS_SystemInformation')
      .toString()
      .split('\n');

    // save system info to state
    msSystemInformation.forEach(record => {
      const [key, value] = record.split(':').map(item => item.trim());
      if (!key) return;
      if (this.state[key] !== void 0) this.SET_SYSTEM_PARAM(key as keyof IMsSystemInfo, value);
    });

    // uncomment the code below to test brand device steps
    // this.SET_SYSTEM_PARAM('SystemManufacturer', 'Intel Corporation');
    // this.SET_SYSTEM_PARAM('SystemProductName', 'NUC7i5DNHE');
    // this.SET_SYSTEM_PARAM('SystemSKU', '909-0020-010');
    // this.SET_SYSTEM_PARAM('SystemVersion', '1');


    this.SET_DEVICE_URLS(await this.fetchDeviceUrls());
  }

  async startAutoConfig(): Promise<boolean> {

    try {

      const deviceUrls = await this.fetchDeviceUrls();
      const cacheDir = electron.remote.app.getPath('userData');
      const tempDir = electron.remote.app.getPath('temp');

      // download all files

      if (deviceUrls.basic_ini_url) {
        await downloadFile(deviceUrls.basic_ini_url, `${cacheDir}/basic.ini`);
      }

      if (deviceUrls.global_ini_url) {
        await downloadFile(deviceUrls.global_ini_url, `${cacheDir}/global.ini`);
      }

      if (deviceUrls.stream_encoder_url) {
        await downloadFile(deviceUrls.stream_encoder_url, `${cacheDir}/streamEncoder.json`);
      }

      if (deviceUrls.record_encoder_url) {
        await downloadFile(deviceUrls.stream_encoder_url, `${cacheDir}/recordEncoder.json`);
      }

      if (deviceUrls.overlay_url) {
        const overlayPath = `${tempDir}/slobs-brand-device.overlay`;
        await downloadFile(deviceUrls.overlay_url, overlayPath);
        await this.sceneCollectionsService.loadOverlay(overlayPath, this.state.urls.name);
      }

      // force SLOBS to reload config files
      obs.NodeObs.OBS_service_resetVideoContext();
      obs.NodeObs.OBS_service_resetAudioContext();

      return true;
    } catch (e) {
      return false;
    }
  }

  private async fetchDeviceUrls(): Promise<IBrandDeviceUrls> {

    // this combination of system params must be unique for each device type
    // so use it as ID
    const id = [
      this.state.SystemManufacturer,
      this.state.SystemProductName,
      this.state.SystemSKU,
      this.state.SystemVersion
    ].join(' ');

    const res = await fetch(`https://${ this.hostsService.streamlabs}/api/v5/slobs/intelconfig/${id}`);
    if (!res.ok) return null;
    return res.json();
  }

  @mutation()
  private SET_SYSTEM_PARAM(key: keyof IBrandDeviceState, value: string) {
    this.state[key] = value;
  }

  @mutation()
  private SET_DEVICE_URLS(urls: IBrandDeviceUrls) {
    this.state.urls = urls;
  }
}
