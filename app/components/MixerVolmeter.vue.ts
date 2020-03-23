import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { Subscription } from 'rxjs';
import { AudioSource, AudioService, IVolmeter } from 'services/audio';
import { Inject } from 'services/core/injector';
import { CustomizationService } from 'services/customization';
import { compileShader, createProgram } from 'util/webgl/utils';
import vShaderSrc from 'util/webgl/shaders/volmeter.vert';
import fShaderSrc from 'util/webgl/shaders/volmeter.frag';
import electron from 'electron';
import TsxComponent, { createProps } from './tsx-component';
import { v2 } from '../util/vec2';
import uuid from 'uuid';

// Configuration
const CHANNEL_HEIGHT = 3;
const PADDING_HEIGHT = 2;
const PEAK_WIDTH = 4;
const PEAK_HOLD_CYCLES = 100;
const WARNING_LEVEL = -20;
const DANGER_LEVEL = -9;

// Colors (RGB)
const GREEN = [49, 195, 162];
const YELLOW = [255, 205, 71];
const RED = [252, 62, 63];
const FPS_LIMIT = 60;

class MixerVolmeterProps {
  audioSource: AudioSource = null;
}

@Component({ props: createProps(MixerVolmeterProps) })
export default class MixerVolmeter extends TsxComponent<MixerVolmeterProps> {
  @Inject() customizationService: CustomizationService;
  @Inject() audioService: AudioService;

  volmeterSubscription: Subscription;

  $refs: {
    canvas: HTMLCanvasElement;
    spacer: HTMLDivElement;
  };

  // Used for Canvas 2D rendering
  ctx: CanvasRenderingContext2D;

  // Used for WebGL rendering
  gl: WebGLRenderingContext;
  program: WebGLProgram;

  // GL Attribute locations
  positionLocation: number;

  // GL Uniform locations
  resolutionLocation: WebGLUniformLocation;
  translationLocation: WebGLUniformLocation;
  scaleLocation: WebGLUniformLocation;
  volumeLocation: WebGLUniformLocation;
  peakHoldLocation: WebGLUniformLocation;
  bgMultiplierLocation: WebGLUniformLocation;

  peakHoldCounters: number[];
  peakHolds: number[];

  canvasWidth: number;
  canvasWidthInterval: number;
  channelCount: number;
  canvasHeight: number;

  // Used to force recreation of the canvas element
  canvasId = 1;

  // Used for lazy initialization of the canvas rendering
  renderingInitialized = false;

  // Current peak values
  currentPeaks: number[];
  // Store prevPeaks and interpolatedPeaks values for smooth interpolated rendering
  prevPeaks: number[];
  interpolatedPeaks: number[];
  // the time of last received peaks
  lastEventTime: number;
  // time between 2 received peaks.
  // Used to render extra interpolated frames
  interpolationTime = 35;
  bg: { r: number; g: number; b: number };

  firstFrameTime: number;
  frameNumber: number;

  mounted() {
    this.subscribeVolmeter();
    this.peakHoldCounters = [];
    this.peakHolds = [];

    this.setupNewCanvas();
  }

  beforeDestroy() {
    this.$refs.canvas.removeEventListener('webglcontextlost', this.handleLostWebglContext);
    if (this.gl) window['activeWebglContexts'] -= 1;
    clearInterval(this.canvasWidthInterval);
    this.unsubscribeVolmeter();
  }

  private setupNewCanvas() {
    // Make sure all state is cleared out
    this.ctx = null;
    this.gl = null;
    this.program = null;
    this.positionLocation = null;
    this.resolutionLocation = null;
    this.translationLocation = null;
    this.scaleLocation = null;
    this.volumeLocation = null;
    this.peakHoldLocation = null;
    this.bgMultiplierLocation = null;
    this.canvasWidth = null;
    this.channelCount = null;
    this.canvasHeight = null;

    this.renderingInitialized = false;

    // Assume 2 channels until we know otherwise. This prevents too much
    // visual jank as the volmeters are initializing.
    this.setChannelCount(2);

    this.setCanvasWidth();
    this.canvasWidthInterval = window.setInterval(() => this.setCanvasWidth(), 500);
    requestAnimationFrame(t => this.onRequestAnimationFrameHandler(t));
  }

  /**
   * Render volmeters with FPS capping
   */
  private onRequestAnimationFrameHandler(now: DOMHighResTimeStamp) {
    // init first rendering frame
    if (!this.frameNumber) {
      this.frameNumber = -1;
      this.firstFrameTime = now;
    }

    const timeElapsed = now - this.firstFrameTime;
    const timeBetweenFrames = 1000 / FPS_LIMIT;
    const currentFrameNumber = Math.ceil(timeElapsed / timeBetweenFrames);

    if (currentFrameNumber !== this.frameNumber) {
      // it's time to render next frame
      this.frameNumber = currentFrameNumber;
      // don't render sources then channelsCount is 0
      // happens when the browser source stops playing audio
      if (this.renderingInitialized && this.currentPeaks && this.currentPeaks.length) {
        if (this.gl) {
          this.drawVolmeterWebgl(this.currentPeaks);
        } else {
          this.drawVolmeterC2d(this.currentPeaks);
        }
      }
    }
    requestAnimationFrame(t => this.onRequestAnimationFrameHandler(t));
  }

  private initRenderingContext() {
    if (this.renderingInitialized) return;

    this.gl = this.$refs.canvas.getContext('webgl', { alpha: false });

    if (this.gl) {
      this.initWebglRendering();

      // Get ready to lose this conext if too many are created
      if (window['activeWebglContexts'] == null) window['activeWebglContexts'] = 0;
      window['activeWebglContexts'] += 1;
      this.$refs.canvas.addEventListener('webglcontextlost', this.handleLostWebglContext);
    } else {
      // This machine does not support hardware acceleration, or it has been disabled
      // Fall back to canvas 2d rendering instead.
      this.ctx = this.$refs.canvas.getContext('2d', { alpha: false });
    }

    this.renderingInitialized = true;
  }

  private handleLostWebglContext() {
    // Only do this if there are free contexts, otherwise we will churn forever
    if (window['activeWebglContexts'] < 16) {
      console.warn('Lost WebGL context and attempting restore.');

      if (this.canvasWidthInterval) {
        clearInterval(this.canvasWidthInterval);
        this.canvasWidthInterval = null;
      }
      this.$refs.canvas.removeEventListener('webglcontextlost', this.handleLostWebglContext);
      window['activeWebglContexts'] -= 1;

      this.canvasId += 1;

      this.$nextTick(() => {
        this.setupNewCanvas();
      });
    } else {
      console.warn('Lost WebGL context and not attempting restore due to too many active contexts');
    }
  }

  private initWebglRendering() {
    const vShader = compileShader(this.gl, vShaderSrc, this.gl.VERTEX_SHADER);
    const fShader = compileShader(this.gl, fShaderSrc, this.gl.FRAGMENT_SHADER);
    this.program = createProgram(this.gl, vShader, fShader);

    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

    // Vertex geometry for a unit square
    // eslint-disable-next-line
    const positions = [
      0, 0,
      0, 1,
      1, 0,
      1, 0,
      0, 1,
      1, 1,
    ];

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

    // look up where the vertex data needs to go.
    this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');

    // lookup uniforms
    this.resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
    this.translationLocation = this.gl.getUniformLocation(this.program, 'u_translation');
    this.scaleLocation = this.gl.getUniformLocation(this.program, 'u_scale');
    this.volumeLocation = this.gl.getUniformLocation(this.program, 'u_volume');
    this.peakHoldLocation = this.gl.getUniformLocation(this.program, 'u_peakHold');
    this.bgMultiplierLocation = this.gl.getUniformLocation(this.program, 'u_bgMultiplier');

    this.gl.useProgram(this.program);

    const warningLocation = this.gl.getUniformLocation(this.program, 'u_warning');
    this.gl.uniform1f(warningLocation, this.dbToUnitScalar(WARNING_LEVEL));

    const dangerLocation = this.gl.getUniformLocation(this.program, 'u_danger');
    this.gl.uniform1f(dangerLocation, this.dbToUnitScalar(DANGER_LEVEL));

    // Set colors
    this.setColorUniform('u_green', GREEN);
    this.setColorUniform('u_yellow', YELLOW);
    this.setColorUniform('u_red', RED);
  }

  private setColorUniform(uniform: string, color: number[]) {
    const location = this.gl.getUniformLocation(this.program, uniform);
    // eslint-disable-next-line
    this.gl.uniform3fv(location, color.map(c => c / 255));
  }

  private setChannelCount(channels: number) {
    if (channels !== this.channelCount) {
      this.channelCount = channels;
      this.canvasHeight = Math.max(
        channels * (CHANNEL_HEIGHT + PADDING_HEIGHT) - PADDING_HEIGHT,
        0,
      );

      if (!this.$refs.canvas) return;

      this.$refs.canvas.height = this.canvasHeight;
      this.$refs.canvas.style.height = `${this.canvasHeight}px`;
      this.$refs.spacer.style.height = `${this.canvasHeight}px`;
    }
  }

  private setCanvasWidth() {
    const width = Math.floor(this.$refs.canvas.parentElement.offsetWidth);

    if (width !== this.canvasWidth) {
      this.canvasWidth = width;
      this.$refs.canvas.width = width;
      this.$refs.canvas.style.width = `${width}px`;
    }
  }

  private getBgMultiplier() {
    // Volmeter backgrounds appear brighter against a darker background
    return this.customizationService.isDarkTheme ? 0.2 : 0.5;
  }

  private drawVolmeterWebgl(peaks: number[]) {
    const bg = this.bg;

    this.gl.clearColor(bg.r / 255, bg.g / 255, bg.b / 255, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    if (this.canvasWidth < 0 || this.canvasHeight < 0) return;

    this.gl.viewport(0, 0, this.canvasWidth, this.canvasHeight);

    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Set uniforms
    this.gl.uniform2f(this.resolutionLocation, 1, this.canvasHeight);

    this.gl.uniform1f(this.bgMultiplierLocation, this.getBgMultiplier());

    peaks.forEach((peak, channel) => {
      this.drawVolmeterChannelWebgl(peak || 0, channel);
    });
  }

  private drawVolmeterChannelWebgl(peak: number, channel: number) {
    this.updatePeakHold(peak, channel);

    this.gl.uniform2f(this.scaleLocation, 1, CHANNEL_HEIGHT);
    this.gl.uniform2f(this.translationLocation, 0, channel * (CHANNEL_HEIGHT + PADDING_HEIGHT));

    const prevPeak = this.prevPeaks && this.prevPeaks[channel] ? this.prevPeaks[channel] : peak;
    const timeDelta = performance.now() - this.lastEventTime;
    let alpha = timeDelta / this.interpolationTime;
    if (alpha > 1) alpha = 1;
    const interpolatedPeak = this.lerp(prevPeak, peak, alpha);
    if (!this.interpolatedPeaks) this.interpolatedPeaks = [];
    this.interpolatedPeaks[channel] = interpolatedPeak;
    this.gl.uniform1f(this.volumeLocation, this.dbToUnitScalar(interpolatedPeak));

    // X component is the location of peak hold from 0 to 1
    // Y component is width of the peak hold from 0 to 1
    this.gl.uniform2f(
      this.peakHoldLocation,
      this.dbToUnitScalar(this.peakHolds[channel]),
      PEAK_WIDTH / this.canvasWidth,
    );

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  private drawVolmeterC2d(peaks: number[]) {
    if (this.canvasWidth < 0 || this.canvasHeight < 0) return;

    const bg = this.customizationService.themeBackground;
    this.ctx.fillStyle = this.rgbToCss([bg.r, bg.g, bg.b]);
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    peaks.forEach((peak, channel) => {
      this.drawVolmeterChannelC2d(peak, channel);
    });
  }

  private drawVolmeterChannelC2d(peak: number, channel: number) {
    this.updatePeakHold(peak, channel);

    const heightOffset = channel * (CHANNEL_HEIGHT + PADDING_HEIGHT);
    const warningPx = this.dbToPx(WARNING_LEVEL);
    const dangerPx = this.dbToPx(DANGER_LEVEL);

    const bgMultiplier = this.getBgMultiplier();

    this.ctx.fillStyle = this.rgbToCss(GREEN, bgMultiplier);
    this.ctx.fillRect(0, heightOffset, warningPx, CHANNEL_HEIGHT);
    this.ctx.fillStyle = this.rgbToCss(YELLOW, bgMultiplier);
    this.ctx.fillRect(warningPx, heightOffset, dangerPx - warningPx, CHANNEL_HEIGHT);
    this.ctx.fillStyle = this.rgbToCss(RED, bgMultiplier);
    this.ctx.fillRect(dangerPx, heightOffset, this.canvasWidth - dangerPx, CHANNEL_HEIGHT);

    const peakPx = this.dbToPx(peak);

    const greenLevel = Math.min(peakPx, warningPx);
    this.ctx.fillStyle = this.rgbToCss(GREEN);
    this.ctx.fillRect(0, heightOffset, greenLevel, CHANNEL_HEIGHT);

    if (peak > WARNING_LEVEL) {
      const yellowLevel = Math.min(peakPx, dangerPx);
      this.ctx.fillStyle = this.rgbToCss(YELLOW);
      this.ctx.fillRect(warningPx, heightOffset, yellowLevel - warningPx, CHANNEL_HEIGHT);
    }

    if (peak > DANGER_LEVEL) {
      this.ctx.fillStyle = this.rgbToCss(RED);
      this.ctx.fillRect(dangerPx, heightOffset, peakPx - dangerPx, CHANNEL_HEIGHT);
    }

    this.ctx.fillStyle = this.rgbToCss(GREEN);
    if (this.peakHolds[channel] > WARNING_LEVEL) this.ctx.fillStyle = this.rgbToCss(YELLOW);
    if (this.peakHolds[channel] > DANGER_LEVEL) this.ctx.fillStyle = this.rgbToCss(RED);
    this.ctx.fillRect(
      this.dbToPx(this.peakHolds[channel]),
      heightOffset,
      PEAK_WIDTH,
      CHANNEL_HEIGHT,
    );
  }

  private dbToUnitScalar(db: number) {
    return Math.max((db + 60) * (1 / 60), 0);
  }

  private dbToPx(db: number) {
    return Math.round((db + 60) * (this.canvasWidth / 60));
  }

  /**
   * Converts RGB components into a CSS string, and optionally applies
   * a multiplier to lighten or darken the color without changing its hue.
   * @param rgb An array containing the RGB values from 0-255
   * @param multiplier A multiplier to lighten or darken the color
   */
  private rgbToCss(rgb: number[], multiplier = 1) {
    return `rgb(${rgb.map(v => Math.round(v * multiplier)).join(',')})`;
  }

  updatePeakHold(peak: number, channel: number) {
    if (!this.peakHoldCounters[channel] || peak > this.peakHolds[channel]) {
      this.peakHolds[channel] = peak;
      this.peakHoldCounters[channel] = PEAK_HOLD_CYCLES;
      return;
    }

    this.peakHoldCounters[channel] -= 1;
  }

  workerId: number;

  listener: (e: Electron.Event, volmeter: IVolmeter) => void;

  subscribeVolmeter() {
    this.listener = (e: Electron.Event, volmeter: IVolmeter) => {
      if (this.$refs.canvas) {
        // don't init context for inactive sources
        if (!volmeter.peak.length && !this.renderingInitialized) return;

        this.initRenderingContext();
        this.setChannelCount(volmeter.peak.length);

        // save peaks value to render it in the next animationFrame
        this.prevPeaks = this.interpolatedPeaks;
        this.currentPeaks = Array.from(volmeter.peak);
        this.lastEventTime = performance.now();
        this.bg = this.customizationService.themeBackground;
      }
    };

    electron.ipcRenderer.on(`volmeter-${this.props.audioSource.sourceId}`, this.listener);

    // TODO: Remove sync
    this.workerId = electron.ipcRenderer.sendSync('getWorkerWindowId');

    electron.ipcRenderer.sendTo(
      this.workerId,
      'volmeterSubscribe',
      this.props.audioSource.sourceId,
    );
  }

  unsubscribeVolmeter() {
    electron.ipcRenderer.removeListener(
      `volmeter-${this.props.audioSource.sourceId}`,
      this.listener,
    );
    electron.ipcRenderer.sendTo(
      this.workerId,
      'volmeterUnsubscribe',
      this.props.audioSource.sourceId,
    );
  }

  /**
   * Linearly interpolates between val1 and val2
   * alpha = 0 will be val1, and alpha = 1 will be val2.
   */
  lerp(val1: number, val2: number, alpha: number) {
    const result = v2(val1, 0).lerp(v2(val2, 0), alpha);
    return result.x;
  }
}
