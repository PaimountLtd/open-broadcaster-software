import electron from 'electron';
import { Service } from './service';
import fs from 'fs';
import path from 'path';
import { ScenesService } from './scenes';
import { SourcesService } from './sources';
import { SourceFiltersService } from './source-filters';
import { ScenesTransitionsService } from './scenes-transitions';
import { AudioService } from './audio';
import { Inject } from '../util/injector';
import { ScenesCollectionsService } from './scenes-collections/config';
import { AppService } from './app';
import { nodeObs } from './obs-api';

interface Source {
  name?: string;
  sourceId?: string;
}

interface ISceneCollection {
  filename: string;
  name: string;
}

export class ObsImporterService extends Service {
  @Inject() scenesService: ScenesService;

  @Inject() sourcesService: SourcesService;

  @Inject('SourceFiltersService') filtersService: SourceFiltersService;

  @Inject('ScenesTransitionsService')
  transitionsService: ScenesTransitionsService;

  @Inject() scenesCollectionsService: ScenesCollectionsService;

  @Inject() audioService: AudioService;

  @Inject() appService: AppService;

  async load(selectedprofile: string) {
    if (!this.isOBSinstalled()) return;

    // Scene collections
    const collections = this.getSceneCollections();
    for (const collection of collections) {
      this.appService.reset();
      await this.importCollection(collection);
    }

    // Profile
    this.importProfile(selectedprofile);

    nodeObs.OBS_service_resetVideoContext();
    nodeObs.OBS_service_resetAudioContext();
  }

  private importCollection(collection: ISceneCollection): Promise<void> {
    const sceneCollectionPath = path.join(
      this.sceneCollectionsDirectory,
      collection.filename
    );
    const configJSON = JSON.parse(
      fs.readFileSync(sceneCollectionPath).toString()
    );

    this.importSources(configJSON);
    this.importScenes(configJSON);
    this.importSceneOrder(configJSON);
    this.importMixerSources(configJSON);
    this.importTransitions(configJSON);
    if (this.scenesService.scenes.length === 0) {
      this.scenesCollectionsService.setUpDefaults();
    }
    return this.scenesCollectionsService.rawSave(collection.name);
  }

  importFilters(filtersJSON: any, source: Source) {
    if (Array.isArray(filtersJSON)) {
      filtersJSON.forEach(filterJSON => {
        const isFilterAvailable = this.filtersService
          .getTypes()
          .find(availableFilter => {
            return availableFilter.type === filterJSON.id;
          });

        if (isFilterAvailable) {
          const sourceId = this.sourcesService.getSourcesByName(source.name)[0]
            .sourceId;

          const filter = this.filtersService.add(
            sourceId,
            filterJSON.id,
            filterJSON.name
          );
          filter.enabled = filterJSON.enabled;

          // Setting properties
          const properties = this.filtersService.getPropertiesFormData(
            sourceId,
            filterJSON.name
          );

          if (properties) {
            if (Array.isArray(properties)) {
              properties.forEach(property => {
                if (filterJSON.settings[property.name]) {
                  property.value = filterJSON.settings[property.name];
                }
              });
            }
          }

          this.filtersService.setPropertiesFormData(
            sourceId,
            filterJSON.name,
            properties
          );
        } else {
          // TODO Report to the user that slobs does not support the filter
        }
      });
    }
  }

  importSources(configJSON: any) {
    const sourcesJSON = configJSON.sources;

    if (Array.isArray(sourcesJSON)) {
      sourcesJSON.forEach(sourceJSON => {
        const isSourceAvailable = this.sourcesService
          .getAvailableSourcesTypes()
          .includes(sourceJSON.id);

        if (isSourceAvailable) {
          if (sourceJSON.id !== 'scene') {
            const source = this.sourcesService.createSource(
              sourceJSON.name,
              sourceJSON.id,
              sourceJSON.settings,
              {
                channel: sourceJSON.channel !== 0 ? sourceJSON.channel : void 0
              }
            );

            if (source.audio) {
              this.audioService
                .getSource(source.sourceId)
                .setMuted(sourceJSON.muted);
              this.audioService
                .getSource(source.sourceId)
                .setDeflection(sourceJSON.volume);

              this.audioService.getSource(source.sourceId).setSettings({
                forceMono: sourceJSON.flags > 0,
                syncOffset: sourceJSON.sync
                  ? AudioService.timeSpecToMs(sourceJSON.sync)
                  : 0,
                audioMixers: sourceJSON.mixers,
                monitoringType: sourceJSON.monitoring_type
              });
            }

            // Adding the filters
            const filtersJSON = sourceJSON.filters;
            this.importFilters(filtersJSON, source);
          }
        } else {
          // TODO Report to the user that slobs does not support the source
        }
      });
    }
  }

  importScenes(configJSON: any) {
    const sourcesJSON = configJSON.sources;
    const currentScene = configJSON.current_scene;

    if (Array.isArray(sourcesJSON)) {
      // Create all the scenes
      sourcesJSON.forEach(sourceJSON => {
        if (sourceJSON.id === 'scene') {
          const scene = this.scenesService.createScene(sourceJSON.name, {
            makeActive: sourceJSON.name === currentScene
          });
        }
      });

      // Add all the sceneItems to every scene
      sourcesJSON.forEach(sourceJSON => {
        if (sourceJSON.id === 'scene') {
          const scene = this.scenesService.getSceneByName(sourceJSON.name);
          if (!scene) return;

          const sceneItems = sourceJSON.settings.items;
          if (Array.isArray(sceneItems)) {
            // Looking for the source to add to the scene
            sceneItems.forEach(item => {
              const sourceToAdd = this.sourcesService
                .getSources()
                .find(source => {
                  return source.name === item.name;
                });
              if (sourceToAdd) {
                const sceneItem = scene.addSource(sourceToAdd.sourceId);

                const crop = {
                  bottom: item.crop_bottom,
                  left: item.crop_left,
                  right: item.crop_right,
                  top: item.crop_top
                };
                const pos = item.pos;
                const scale = item.scale;

                sceneItem.setCrop(crop);
                sceneItem.setPositionAndScale(pos.x, pos.y, scale.x, scale.y);
                sceneItem.setVisibility(item.visible);
              }
            });
          }
        }
      });
    }
  }

  importSceneOrder(configJSON: any) {
    const sceneNames: string[] = [];
    const sceneOrderJSON = configJSON.scene_order;
    const listScene = this.scenesService.scenes;

    if (Array.isArray(sceneOrderJSON)) {
      sceneOrderJSON.forEach(obsScene => {
        sceneNames.push(
          listScene.find(scene => {
            return scene.name === obsScene.name;
          }).id
        );
      });
    }
    this.scenesService.setSceneOrder(sceneNames);
  }

  importMixerSources(configJSON: any) {
    const channelNames = [
      'DesktopAudioDevice1',
      'DesktopAudioDevice2',
      'AuxAudioDevice1',
      'AuxAudioDevice2',
      'AuxAudioDevice3'
    ];
    channelNames.forEach((channelName, i) => {
      const audioSource = configJSON[channelName];
      if (audioSource) {
        const newSource = this.sourcesService.createSource(
          channelName,
          audioSource.id,
          {},
          { channel: i + 1 }
        );

        this.audioService
          .getSource(newSource.sourceId)
          .setMuted(audioSource.muted);
        this.audioService
          .getSource(newSource.sourceId)
          .setDeflection(audioSource.volume);

        this.audioService.getSource(newSource.sourceId).setSettings({
          forceMono: audioSource.flags > 0,
          syncOffset: audioSource.sync
            ? AudioService.timeSpecToMs(audioSource.sync)
            : 0,
          audioMixers: audioSource.mixers,
          monitoringType: audioSource.monitoring_type
        });
      }
    });
  }

  importTransitions(configJSON: any) {
    // Only import the first transition found in obs as slobs only
    // uses one global transition
    if (configJSON.transitions && configJSON.transitions.length > 0) {
      this.transitionsService.setType(configJSON.transitions[0].id);
      this.transitionsService.setDuration(configJSON.transition_duration);
    }
  }

  importProfile(profile: string) {
    const profileDirectory = path.join(this.profilesDirectory, profile);
    const files = fs.readdirSync(profileDirectory);

    files.forEach(file => {
      if (
        file === 'basic.ini' ||
        file === 'streamEncoder.json' ||
        file === 'recordEncoder.json'
      ) {
        const obsFilePath = path.join(profileDirectory, file);

        const appData = electron.remote.app.getPath('userData');
        const currentFilePath = path.join(appData, file);

        const readData = fs.readFileSync(obsFilePath);
        fs.writeFileSync(currentFilePath, readData);
      }
    });
  }

  getSceneCollections(): ISceneCollection[] {
    if (!this.isOBSinstalled()) return [];

    let files = fs.readdirSync(this.sceneCollectionsDirectory);

    files = files.filter(file => !file.match(/\.bak$/));
    return files.map(file => {
      return {
        filename: file,
        name: file.replace('_', ' ').replace('.json', '')
      };
    });
  }

  getProfiles(): string[] {
    if (!this.isOBSinstalled()) return [];

    let profiles = fs.readdirSync(this.profilesDirectory);
    profiles = profiles.filter(profile => !profile.match(/\./));
    return profiles;
  }

  get OBSconfigFileDirectory() {
    return path.join(electron.remote.app.getPath('appData'), 'obs-studio');
  }

  get sceneCollectionsDirectory() {
    return path.join(this.OBSconfigFileDirectory, 'basic/scenes/');
  }

  get profilesDirectory() {
    return path.join(this.OBSconfigFileDirectory, 'basic/profiles');
  }

  isOBSinstalled() {
    return fs.existsSync(this.OBSconfigFileDirectory);
  }
}
