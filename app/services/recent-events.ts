import { HostsService } from 'services/hosts';
import { StatefulService, Inject, mutation } from 'services/core';
import { UserService, LoginLifecycle } from 'services/user';
import { authorizedHeaders, handleResponse } from 'util/requests';
import { $t } from 'services/i18n';
import { WindowsService } from 'services/windows';
import { WebsocketService, TSocketEvent, IEventSocketEvent } from 'services/websocket';
import pick from 'lodash/pick';
import uuid from 'uuid/v4';

export interface IRecentEvent {
  name?: string;
  from?: string;
  type: string;
  platform: string;
  created_at: string;
  display_name?: string;
  from_display_name?: string;
  amount?: string;
  crate_item?: any;
  message?: string;
  product?: string;
  viewers?: number;
  host_type?: 'manual' | 'auto';
  raiders?: number;
  formatted_amount?: string;
  sub_plan?: string;
  months?: number;
  streak_months?: number;
  gifter?: string;
  currency?: string;
  skill?: string;
  since?: string;
  displayString?: string;
  comment?: string;
  title?: string;
  iso8601Created?: string;
  createdAt?: string;
  streamer?: string;
  giftType?: string;
  _id?: string;
  read: boolean;
  hash: string;
  isTest?: boolean;
  repeat?: boolean;
  // uuid is local and will NOT persist across app restarts/ fetches
  uuid: string;
}

interface IRecentEventsState {
  recentEvents: IRecentEvent[];
  muted: boolean;
}

const subscriptionMap = (subPlan: string) => {
  return {
    '1000': $t('Tier 1'),
    '2000': $t('Tier 2'),
    '3000': $t('Tier 3'),
    Prime: $t('Prime'),
  }[subPlan];
};

/**
 * This function duplicates per-event logic from streamlabs.com for
 * creating cache keys used in fetching read status of events and
 * serves as the best proxy for a unique identifier for each
 * event. Should be refactored when backend is rewritten for consistency
 */
function getHashForRecentEvent(event: IRecentEvent) {
  switch (event.type) {
    case 'donation':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'bits':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'donordrivedonation':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'eldonation':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'follow':
      return [event.type, event.name, event.message].join(':');
    case 'host':
      return [event.type, event.name, event.host_type].join(':');
    case 'justgivingdonation':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'loyalty_store_redemption':
      return [event.type, event.from, event.message].join(':');
    case 'pledge':
      return [event.type, event.name, parseInt(event.amount, 10), event.from].join(':');
    case 'prime_sub_gift':
      return [event.type, event.name, event.streamer, event.giftType].join(':');
    case 'raid':
      return [event.type, event.name, event.from].join(':');
    case 'redemption':
      return [event.type, event.name, event.message].join(':');
    case 'sticker':
      return [event.name, event.type, event.currency].join(':');
    case 'subscription':
      return [event.type, event.name, event.message].join(':');
    case 'superchat':
      return [event.type, event.name, event.message].join(':');
    case 'superheart':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'tiltifydonation':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'treat':
      return [event.type, event.name, event.title, event.message, event.createdAt].join(':');
    case 'like':
      return [event.type, event.name, event._id].join(':');
    case 'share':
      return [event.type, event.name, event._id].join(':');
    case 'stars':
      return [event.type, event.name, event.message, parseInt(event.amount, 10)].join(':');
    case 'support':
      return [event.type, event.name, event._id].join(':');
    case 'merch':
      return [event.type, event.message, event.createdAt].join(':');
    default:
      return [event.type, event._id].join(':');
  }
}

const SUPPORTED_EVENTS = [
  'merch',
  'donation',
  'facemaskdonation',
  'follow',
  'subscription',
  'bits',
  'host',
  'raid',
  'sticker',
  'effect',
  'like',
  'stars',
  'support',
  'share',
  'superchat',
  'pledge',
  'eldonation',
  'tiltifydonation',
  'donordrivedonation',
  'justgivingdonation',
  'treat',
];

export class RecentEventsService extends StatefulService<IRecentEventsState> {
  @Inject() private hostsService: HostsService;
  @Inject() private userService: UserService;
  @Inject() private windowsService: WindowsService;
  @Inject() private websocketService: WebsocketService;

  static initialState: IRecentEventsState = { recentEvents: [], muted: false };

  lifecycle: LoginLifecycle;

  async initialize() {
    this.lifecycle = await this.userService.withLifecycle({
      init: this.syncEventsState,
      destroy: () => Promise.resolve(this.SET_RECENT_EVENTS([])),
      context: this,
    });
  }

  syncEventsState() {
    this.formEventsArray();
    this.websocketService.socketEvent.subscribe(this.onSocketEvent.bind(this));
    return this.fetchMutedState();
  }

  fetchRecentEvents(): Promise<{ data: Dictionary<IRecentEvent[]> }> {
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs/recentevents/${
      this.userService.widgetToken
    }`;
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers });
    return fetch(request)
      .then(handleResponse)
      .catch(() => null);
  }

  fetchMutedState() {
    const url = `https://${
      this.hostsService.streamlabs
    }/api/v5/slobs/widget/config?widget=recent_events`;
    const headers = authorizedHeaders(this.userService.apiToken);
    return fetch(new Request(url, { headers }))
      .then(handleResponse)
      .then(resp => this.SET_MUTED(resp.eventsPanelMuted));
  }

  private async formEventsArray() {
    const events = await this.fetchRecentEvents();
    let eventArray: IRecentEvent[] = [];
    if (!events.data) return;
    Object.keys(events.data).forEach(key => {
      const fortifiedEvents = events.data[key].map(event => {
        event.hash = getHashForRecentEvent(event);
        event.uuid = uuid();
        return event;
      });

      // This server response returns a ton of stuff. We remove the noise
      // before adding it to the store.
      const culledEvents = fortifiedEvents.map(event => {
        return pick(event, [
          'name',
          'from',
          'type',
          'platform',
          'created_at',
          'display_name',
          'from_display_name',
          'amount',
          'crate_item',
          'message',
          'product',
          'viewers',
          'host_type',
          'raiders',
          'formatted_amount',
          'sub_plan',
          'months',
          'streak_months',
          'gifter',
          'currency',
          'skill',
          'since',
          'displayString',
          'comment',
          'title',
          'read',
          'hash',
          'uuid',
        ]);
      });

      eventArray = eventArray.concat(culledEvents);
    });

    // Format string of keys to look for in server event cache
    const hashValues = eventArray.map(event => event.hash).join('|##|');

    // Get read status for all events
    const readReceipts = await this.fetchReadReceipts(hashValues);
    eventArray.forEach(event => {
      event.read = readReceipts[event.hash] ? readReceipts[event.hash] : false;
    });

    eventArray.sort((a: IRecentEvent, b: IRecentEvent) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    this.SET_RECENT_EVENTS(eventArray);
  }

  async fetchReadReceipts(hashValues: string): Promise<{ data: Dictionary<boolean> }> {
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs/readreceipts`;
    const headers = authorizedHeaders(
      this.userService.apiToken,
      new Headers({ 'Content-Type': 'application/json' }),
    );
    const request = new Request(url, { headers });
    const body = JSON.stringify({
      hashValues,
    });
    return await fetch(new Request(url, { headers, body, method: 'POST' })).then(handleResponse);
  }

  async repeatAlert(event: IRecentEvent) {
    const headers = authorizedHeaders(
      this.userService.apiToken,
      new Headers({ 'Content-Type': 'application/json' }),
    );
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs/widget/repeatalert`;
    const body = JSON.stringify({
      data: event,
      type: event.type,
      token: this.userService.widgetToken,
    });
    return await fetch(new Request(url, { headers, body, method: 'POST' })).then(handleResponse);
  }

  async readAlert(event: IRecentEvent) {
    this.TOGGLE_RECENT_EVENT_READ(event.uuid);
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs/widget/readalert`;
    const headers = authorizedHeaders(
      this.userService.apiToken,
      new Headers({ 'Content-Type': 'application/json' }),
    );
    const body = JSON.stringify({
      eventHash: event.hash,
      read: event.read,
    });
    const request = new Request(url, { headers, body, method: 'POST' });
    return await fetch(request).then(handleResponse);
  }

  async skipAlert() {
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs/alerts/skip`;
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers, method: 'POST' });
    return await fetch(request).then(handleResponse);
  }

  async pauseAlertQueue() {
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs/alerts/pause_queue`;
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers, method: 'POST' });
    return fetch(request).then(handleResponse);
  }

  async unpauseAlertQueue() {
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs/alerts/unpause_queue`;
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers, method: 'POST' });
    return fetch(request).then(handleResponse);
  }

  getSubString(event: IRecentEvent) {
    if (event.gifter) {
      return $t('has gifted a sub (%{tier}) to', {
        tier: subscriptionMap(event.sub_plan),
      });
    }
    if (event.months > 1 && event.streak_months && event.streak_months > 1) {
      return $t('has resubscribed (%{tier}) for %{streak} months in a row! (%{months} total)', {
        tier: subscriptionMap(event.sub_plan),
        streak: event.streak_months,
        months: event.months,
      });
    }
    if (event.months > 1) {
      return $t('has resubscribed (%{tier}) for %{months} months', {
        tier: subscriptionMap(event.sub_plan),
        months: event.months,
      });
    }
    if (event.platform === 'youtube') {
      return $t('has sponsored since %{date}', { date: event.since });
    }
    return $t('has subscribed (%{tier})', { tier: subscriptionMap(event.sub_plan) });
  }

  onSocketEvent(e: TSocketEvent) {
    if (e.type === 'eventsPanelSettingsUpdate') {
      if (e.message.muted != null) {
        this.SET_MUTED(e.message.muted);
      }
    }

    if (SUPPORTED_EVENTS.includes(e.type)) {
      this.onEventSocket(e as IEventSocketEvent);
    }
  }

  onEventSocket(e: IEventSocketEvent) {
    const messages = e.message.filter(msg => !msg.isTest && !msg.repeat);
    messages.forEach(msg => {
      msg.type = e.type;
      msg.hash = getHashForRecentEvent(msg);
      msg.uuid = uuid();
      msg.read = false;
      msg.iso8601Created = new Date().toISOString();
    });
    this.ADD_RECENT_EVENT(messages);
  }

  getEventString(event: IRecentEvent) {
    return {
      donation:
        $t('has donated') +
        (event.crate_item ? $t(' with %{name}', { name: event.crate_item.name }) : ''),
      merch: $t('has purchased %{product} from the store', { product: event.product }),
      follow: $t('has followed'),
      subscription: this.getSubString(event),
      // Twitch
      bits: $t('has used'),
      host: $t('has hosted you with %{viewers} viewers', { viewers: event.viewers }),
      raid: $t('has raided you with a party of %{viewers}', { viewers: event.raiders }),
      // Mixer
      sticker: $t('has used %{skill} for', { skill: event.skill }),
      effect: $t('has used %{skill} for', { skill: event.skill }),
      // Facebook
      like: $t('has liked'),
      stars: $t('has used'),
      support: $t('has supported for %{mounths} months', { months: event.months }),
      share: $t('has shared'),
      // Youtube
      superchat: $t('has superchatted'),
      // Integrations
      pledge: $t('has pledged on Patreon'),
      eldonation: $t('has donated to ExtraLife'),
      tiltifydonation: $t('has donated to Tiltify'),
      donordrivedonation: $t('has donated to Donor Drive'),
      justgivingdonation: $t('has donated to Just Giving'),
      treat: $t('has given a treat %{title}', { title: event.title }),
    }[event.type];
  }

  async toggleMuteEvents() {
    const headers = authorizedHeaders(
      this.userService.apiToken,
      new Headers({ 'Content-Type': 'application/json' }),
    );
    const url = `https://${
      this.hostsService.streamlabs
    }/api/v5/slobs/widget/recentevents/eventspanel`;
    const body = JSON.stringify({ muted: !this.state.muted });
    return await fetch(new Request(url, { headers, body, method: 'POST' })).then(handleResponse);
  }

  openRecentEventsWindow(isMediaShare?: boolean) {
    this.windowsService.createOneOffWindow(
      {
        componentName: 'RecentEvents',
        queryParams: { isMediaShare },
        title: $t('Recent Events'),
        size: { width: 800, height: 600 },
      },
      'RecentEvents',
    );
  }

  @mutation()
  private ADD_RECENT_EVENT(events: IRecentEvent[]) {
    this.state.recentEvents = events.concat(this.state.recentEvents);
  }

  @mutation()
  private TOGGLE_RECENT_EVENT_READ(uuid: string) {
    this.state.recentEvents.forEach(event => {
      if (event.uuid === uuid) {
        event.read = !event.read;
      }
    });
  }

  @mutation()
  private SET_RECENT_EVENTS(eventArray: IRecentEvent[]) {
    this.state.recentEvents = eventArray;
  }

  @mutation()
  private SET_MUTED(muted: boolean) {
    this.state.muted = muted;
  }
}
