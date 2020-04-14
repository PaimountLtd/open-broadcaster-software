import { Component } from 'vue-property-decorator';
import cx from 'classnames';
import TsxComponent from 'components/tsx-component';
import styles from './CommunityHub.m.less';
import { $t } from 'services/i18n';
import { Inject } from 'services';
import { CommunityHubService, IFriend } from 'services/community-hub';

@Component({})
export default class FriendsPage extends TsxComponent {
  @Inject() communityHubService: CommunityHubService;

  get friends() {
    return this.communityHubService.views.sortedFriends;
  }

  get friendRequests() {
    return this.communityHubService.state.friendRequests;
  }

  goToDm(friendId: number) {
    const existingDm = this.communityHubService.views.directMessages.find(
      dm => this.communityHubService.views.usersInRoom(dm.id)[0].id === friendId,
    );
    if (existingDm) {
      this.communityHubService.setPage(existingDm.id);
    } else {
      this.communityHubService.addDm(friendId);
    }
  }

  respondToRequest(requestId: number, accepted: boolean) {
    this.communityHubService.respondToFriendRequest(requestId, accepted);
  }

  basicInfo(friend: IFriend) {
    return (
      <div>
        <img class={styles.avatar} src={friend.avatar} />
        <div class={cx(styles.status, styles[friend.status])} />
        <div class={styles.friendName}>{friend.name}</div>
        {friend.is_prime && <i class={cx('icon-prime', styles.primeIcon)} />}
        {friend.game_streamed && (
          <div class={styles.friendStreaming}>
            {$t('Streaming %{gameTitle}', { gameTitle: friend.game_streamed })}
          </div>
        )}
      </div>
    );
  }

  friendRow(friend: IFriend) {
    return (
      <div class={styles.friend} onClick={() => this.goToDm(friend.id)} key={friend.id}>
        {this.basicInfo(friend)}
        <a style="margin-left: auto">{$t('Direct Message')}</a>
        <a style="margin-left: 16px">{$t('Unfriend')}</a>
      </div>
    );
  }

  friendRequestRow(friend: IFriend, sent?: boolean) {
    return (
      <div class={styles.friend} onClick={() => this.goToDm(friend.id)} key={friend.id}>
        {this.basicInfo(friend)}
        {!sent && (
          <div style="margin-left: auto; display: flex;">
            <button
              class="button button--action"
              onClick={() => this.respondToRequest(friend.id, true)}
            >
              {$t('Accept')}
            </button>
            <button
              style="margin-left: 16px;"
              class="button button--warning"
              onClick={() => this.respondToRequest(friend.id, false)}
            >
              {$t('Decline')}
            </button>
            >
          </div>
        )}
      </div>
    );
  }

  render() {
    return (
      <div>
        <div class={styles.friendsPageHeader}>
          {$t('Received Requests (%{friendCount})', {
            friendCount: this.friendRequests.length,
          })}
        </div>
        {this.friendRequests.map(friend => this.friendRequestRow(friend))}
        <div class={styles.friendsPageHeader}>
          {$t('Friends (%{friendCount} Online)', {
            friendCount: this.communityHubService.views.onlineFriendCount,
          })}
        </div>
        {this.friends.map(friend => this.friendRow(friend))}
      </div>
    );
  }
}
