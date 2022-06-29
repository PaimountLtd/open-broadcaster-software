import { IWidgetTester, IWidget } from './widgets-api';
import { AnchorPoint } from 'util/ScalableRectangle';
import { $t } from 'services/i18n';

export interface IWidgetDisplayData {
  name: string;
  description: string;
  platforms?: Set<string>;
  demoVideo: boolean;
  demoFilename: string;
  supportList: string[];
  icon: string;
  shortDesc?: string;
}
// Do not alter the order of this enum, it is coupled to the user's local config
export enum WidgetType {
  AlertBox = 0,
  DonationGoal = 1,
  FollowerGoal = 2,
  SubscriberGoal = 3,
  BitGoal = 4,
  DonationTicker = 5,
  ChatBox = 6,
  EventList = 7,
  TipJar = 8,
  ViewerCount = 9,
  StreamBoss = 10,
  Credits = 11,
  SpinWheel = 12,
  SponsorBanner = 13,
  MediaShare = 14,
  SubGoal = 15,
  StarsGoal = 16,
  SupporterGoal = 17,
  CharityGoal = 18,
  Poll = 19,
  EmoteWall = 20,
  ChatHighlight = 21,
  SuperchatGoal = 22,
  GameWidget = 23,
}

export const WidgetTesters: IWidgetTester[] = [
  {
    type: 'follows',
    name: 'Follow',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/follow`;
    },
    platforms: ['twitch', 'facebook', 'trovo'],
  },
  {
    name: 'Subscriber',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/follow`;
    },
    platforms: ['youtube'],
  },
  {
    name: 'Subscription',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/subscription`;
    },
    platforms: ['twitch', 'trovo'],
  },
  {
    name: 'Membership',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/subscription`;
    },
    platforms: ['youtube'],
  },
  {
    type: 'donations',
    name: 'Donation',
    url(host) {
      return `https://${host}/api/v5/slobs/test/streamlabs/donation`;
    },
    platforms: ['twitch', 'youtube', 'facebook', 'tiktok', 'trovo'],
  },
  {
    type: 'bits',
    name: 'Bits',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/bits`;
    },
    platforms: ['twitch'],
  },
  {
    name: 'Host',
    type: 'hosts',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/host`;
    },
    platforms: ['twitch'],
  },
  {
    name: 'Super Chat',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/superchat`;
    },
    platforms: ['youtube'],
  },
  {
    name: 'Share',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/share`;
    },
    platforms: ['facebook'],
  },
  {
    name: 'Support',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/support`;
    },
    platforms: ['facebook'],
  },
  {
    name: 'Stars',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/stars`;
    },
    platforms: ['facebook'],
  },
  {
    name: 'Like',
    url(host, platform) {
      return `https://${host}/api/v5/slobs/test/${platform}_account/like`;
    },
    platforms: ['facebook'],
  },
];

export const WidgetDefinitions: { [x: number]: IWidget } = {
  [WidgetType.AlertBox]: {
    name: 'Alert Box',
    url(host, token) {
      return `https://${host}/alert-box/v3/${token}`;
    },

    width: 800,
    height: 600,

    x: 0.5,
    y: 0,

    anchor: AnchorPoint.North,
  },

  [WidgetType.DonationGoal]: {
    name: 'Donation Goal',
    url(host, token) {
      return `https://${host}/widgets/donation-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.FollowerGoal]: {
    name: 'Follower Goal',
    url(host, token) {
      return `https://${host}/widgets/follower-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.SubscriberGoal]: {
    name: 'Subscriber Goal',
    url(host, token) {
      return `https://${host}/widgets/follower-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.SubGoal]: {
    name: 'Sub Goal',
    url(host, token) {
      return `https://${host}/widgets/sub-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.BitGoal]: {
    name: 'Bit Goal',
    url(host, token) {
      return `https://${host}/widgets/bit-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.StarsGoal]: {
    name: 'Stars Goal',
    url(host, token) {
      return `https://${host}/widgets/stars-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.SupporterGoal]: {
    name: 'Supporter Goal',
    url(host, token) {
      return `https://${host}/widgets/supporter-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.SuperchatGoal]: {
    name: 'Superchat Goal',
    url(host, token) {
      return `https://${host}/widgets/super-chat-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.CharityGoal]: {
    name: 'Streamlabs Charity Goal',
    url(host, token) {
      return `https://${host}/widgets/streamlabs-charity-donation-goal?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.DonationTicker]: {
    name: 'Donation Ticker',
    url(host, token) {
      return `https://${host}/widgets/donation-ticker?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 1,
    y: 1,

    anchor: AnchorPoint.SouthEast,
  },

  [WidgetType.ChatBox]: {
    name: 'Chat Box',
    url(host, token) {
      return `https://${host}/widgets/chat-box/v1/${token}`;
    },

    width: 600,
    height: 600,

    x: 0,
    y: 0.5,

    anchor: AnchorPoint.West,
  },

  [WidgetType.EventList]: {
    name: 'Event List',
    url(host, token) {
      return `https://${host}/widgets/event-list/v1/${token}`;
    },

    width: 600,
    height: 600,

    x: 1,
    y: 0,

    anchor: AnchorPoint.NorthEast,
  },

  [WidgetType.TipJar]: {
    name: 'The Jar',
    url(host, token) {
      return `https://${host}/widgets/tip-jar/v1/${token}`;
    },

    width: 600,
    height: 600,

    x: 1,
    y: 0.5,

    anchor: AnchorPoint.East,
  },

  [WidgetType.StreamBoss]: {
    name: 'Stream Boss',
    url(host, token) {
      return `https://${host}/widgets/streamboss?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.Credits]: {
    name: 'Credits',
    url(host, token) {
      return `https://${host}/widgets/end-credits?token=${token}`;
    },

    width: 1280,
    height: 720,

    x: 0.5,
    y: 0.5,

    anchor: AnchorPoint.Center,
  },

  [WidgetType.SponsorBanner]: {
    name: 'Sponsor Banner',
    url(host, token) {
      return `https://${host}/widgets/sponsor-banner?token=${token}`;
    },

    width: 600,
    height: 200,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.SpinWheel]: {
    name: 'Spin Wheel',
    url(host, token) {
      return `https://${host}/widgets/wheel?token=${token}`;
    },

    width: 600,
    height: 800,

    x: 0,
    y: 1,

    anchor: AnchorPoint.SouthWest,
  },

  [WidgetType.MediaShare]: {
    name: 'Media Share',
    url(host, token) {
      return `https://${host}/widgets/media/v1/${token}`;
    },

    width: 800,
    height: 600,

    x: 0.5,
    y: 0,

    anchor: AnchorPoint.North,
  },
  [WidgetType.Poll]: {
    name: 'Poll',
    url(host, token) {
      return `https://${host}/widgets/poll/${token}`;
    },

    width: 800,
    height: 400,

    x: 0.5,
    y: 0.5,

    anchor: AnchorPoint.Center,
  },
  [WidgetType.EmoteWall]: {
    name: 'Emote Wall',
    url(host, token) {
      return `https://${host}/widgets/emote-wall?token=${token}`;
    },

    width: 1280,
    height: 720,

    x: 0.5,
    y: 0.5,

    anchor: AnchorPoint.Center,
  },
  [WidgetType.ChatHighlight]: {
    name: 'Chat Highlight',
    url(host, token) {
      return `https://${host}/widgets/chat-highlight?token=${token}`;
    },

    width: 600,
    height: 300,

    x: 0.5,
    y: 0.5,

    anchor: AnchorPoint.Center,
  },
};

export const WidgetDisplayData = (platform?: string): { [x: number]: IWidgetDisplayData } => ({
  [WidgetType.AlertBox]: {
    name: $t('Alertbox'),
    description: $t('Thanks viewers with notification popups.'),
    demoVideo: false,
    demoFilename: 'source-alertbox.gif',
    supportList: [$t('Donations'), $t('Subscriptions'), $t('Follows'), $t('Bits'), $t('Hosts')],
    icon: 'fas fa-bell',
    shortDesc: $t('Dynamic, live alerts'),
  },
  [WidgetType.DonationGoal]: {
    name: $t('Donation Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: true,
    demoFilename: 'source-donation-goal.mp4',
    supportList: [$t('Donations')],
    icon: 'fas fa-calendar',
  },
  [WidgetType.FollowerGoal]: {
    name: platform === 'youtube' ? $t('Subscription Goal') : $t('Follower Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: false,
    demoFilename: 'source-follower-goal.png',
    platforms: new Set(['twitch', 'facebook', 'youtube', 'trovo']),
    supportList: [
      $t('Twitch Follows'),
      $t('Facebook Follows'),
      $t('YouTube Subscribers'),
      $t('Trovo Follows'),
    ],
    icon: 'fas fa-calendar',
  },
  [WidgetType.SubGoal]: {
    name: platform === 'youtube' ? $t('Member Goal') : $t('Subscription Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: false,
    demoFilename: 'source-follower-goal.png',
    supportList: [$t('Twitch Subscribers'), $t('YouTube Members')],
    platforms: new Set(['twitch', 'youtube']),
    icon: 'fas fa-calendar',
  },
  [WidgetType.BitGoal]: {
    name: $t('Bit Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: false,
    demoFilename: 'source-bit-goal.png',
    supportList: [$t('Twitch Bits')],
    platforms: new Set(['twitch']),
    icon: 'fas fa-calendar',
  },
  [WidgetType.StarsGoal]: {
    name: $t('Stars Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: false,
    demoFilename: 'source-bit-goal.png',
    supportList: [$t('Facebook Stars')],
    platforms: new Set(['facebook']),
    icon: 'fas fa-calendar',
  },
  [WidgetType.SupporterGoal]: {
    name: $t('Supporter Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: false,
    demoFilename: 'source-follower-goal.png',
    supportList: [$t('Facebook Supporters')],
    platforms: new Set(['facebook']),
    icon: 'fas fa-calendar',
  },
  [WidgetType.CharityGoal]: {
    name: $t('Streamlabs Charity Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: true,
    demoFilename: 'source-donation-goal.mp4',
    supportList: [$t('Streamlabs Charity Donations')],
    icon: 'fas fa-calendar',
  },
  [WidgetType.SuperchatGoal]: {
    name: $t('Superchat Goal'),
    description: $t('Set a goal for your viewers to help you reach.'),
    demoVideo: false,
    demoFilename: 'source-follower-goal.png',
    supportList: [$t('YouTube Superchats')],
    platforms: new Set(['youtube']),
    icon: 'fas fa-calendar',
  },
  [WidgetType.DonationTicker]: {
    name: $t('Tip Ticker'),
    description: $t('Show off your most recent donations to your viewers.'),
    demoVideo: false,
    demoFilename: 'source-tip-ticker.png',
    supportList: [$t('Donations')],
    icon: 'fas fa-ellipsis-h',
  },
  [WidgetType.ChatBox]: {
    name: $t('Chatbox'),
    description: $t("Include your channel's chat into your stream."),
    demoVideo: false,
    demoFilename: 'source-chatbox.png',
    supportList: [$t('Twitch chat'), $t('YouTube chat'), $t('Facebook chat')],
    icon: 'fas fa-comments',
  },
  [WidgetType.EventList]: {
    name: $t('Event List'),
    description: $t("Include your channel's most recent events into your stream."),
    demoVideo: false,
    demoFilename: 'source-eventlist.png',
    supportList: [
      $t('Donations'),
      $t('Subscriptions'),
      $t('Follows'),
      $t('Bits'),
      $t('Hosts'),
      $t('Redemptions'),
    ],
    icon: 'fas fa-th-list',
    shortDesc: $t('Display recent events'),
  },
  [WidgetType.TipJar]: {
    name: $t('The Jar'),
    description: $t('The jar that catches bits, tips, and more.'),
    demoVideo: false,
    demoFilename: 'source-jar.png',
    supportList: [$t('Donations'), $t('Subscriptions'), $t('Follows'), $t('Bits'), $t('Hosts')],
    icon: 'fas fa-beer',
  },
  [WidgetType.ViewerCount]: {
    name: $t('Viewer Count'),
    description: $t('Show off your viewers from multiple platforms.'),
    demoVideo: false,
    demoFilename: 'source-viewer-count.png',
    supportList: ['YouTube', 'Twitch', 'Facebook'],
    icon: 'fas fa-eye',
  },
  [WidgetType.StreamBoss]: {
    name: $t('Stream Boss'),
    description: $t('Battle with bits to be the boss of the stream!'),
    demoVideo: false,
    demoFilename: 'source-streamboss.png',
    supportList: [$t('Twitch Bits')],
    icon: 'fas fa-gavel',
  },
  [WidgetType.Credits]: {
    name: $t('Credits'),
    description: $t('Rolling credits to play at the end of your stream.'),
    demoVideo: false,
    demoFilename: 'source-credits.png',
    supportList: [$t('New Followers'), $t('New Subscribers'), $t('Cheers'), $t('Donations')],
    platforms: new Set(['twitch', 'youtube']),
    icon: 'fas fa-align-center',
  },
  [WidgetType.SponsorBanner]: {
    name: $t('Sponsor Banner'),
    description: $t(
      'Set up a sponsor banner to be able to edit (add, remove, update) rotating sponsor logos on streamer channel.',
    ),
    demoVideo: false,
    demoFilename: 'source-sponsor-banner.png',
    supportList: [$t('The streamer manually adds images of sponsors.')],
    icon: 'fas fa-heart',
  },
  [WidgetType.SpinWheel]: {
    name: $t('Spin Wheel'),
    description: $t('Spin the wheel to make a decision.'),
    demoVideo: false,
    demoFilename: 'source-wheel.png',
    supportList: [$t('The streamer manually triggers a spin anytime while they are live.')],
    icon: 'fas fa-chart-pie',
  },
  [WidgetType.MediaShare]: {
    name: $t('Media Share'),
    description: $t(
      'Please note that when advanced media share is enabled,' +
        ' media will no longer play through your alert box widget.' +
        ' Media will only play through this media share widget.',
    ),
    demoVideo: false,
    demoFilename: 'media.png',
    supportList: [],
    icon: 'icon-share',
  },
  [WidgetType.Poll]: {
    name: $t('Poll'),
    description: $t('Let your viewers vote on a result'),
    demoVideo: false,
    demoFilename: 'poll.png',
    supportList: [],
    icon: 'icon-text-align-left',
  },
  [WidgetType.EmoteWall]: {
    name: $t('Emote Wall'),
    description: $t(
      'Display and animate emotes that are seen in chat, improving chat participation via positive feedback.',
    ),
    demoVideo: false,
    demoFilename: 'emote-wall.gif',
    supportList: [],
    platforms: new Set(['twitch']),
    icon: 'icon-smile',
  },
  [WidgetType.ChatHighlight]: {
    name: $t('Chat Highlight'),
    description: $t('Highlight chat messages from your viewers on your stream.'),
    demoVideo: false,
    demoFilename: 'chat-highlight.png',
    supportList: [],
    platforms: new Set(['twitch']),
    icon: 'icon-community',
  },
  [WidgetType.GameWidget]: {
    name: $t('Game Widget'),
    description: $t('Let your viewers play a game in chat'),
    demoVideo: false,
    demoFilename: 'game-widget.png',
    supportList: [],
    platforms: new Set(['twitch']),
    icon: 'icon-face-masks',
  },
});
