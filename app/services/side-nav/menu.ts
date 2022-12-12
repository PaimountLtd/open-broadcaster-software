import { ViewHandler, InitAfter, PersistentStatefulService, Inject } from 'services/core';
import { mutation } from 'services/core/stateful-service';
import { UserService, AppService, DismissablesService, LayoutService } from 'app-services';
import { EDismissable } from 'services/dismissables';
import {
  TMenuItems,
  EMenuItemKey,
  IMenuItem,
  SideNavMenuItems,
  ENavName,
  IMenu,
  IAppMenuItem,
  SideBarTopNavData,
  SideBarBottomNavData,
} from './menu-data';

interface ISideNavServiceState {
  isOpen: boolean;
  showCustomEditor: boolean;
  hasLegacyMenu: boolean;
  compactView: boolean;
  currentMenuItem: EMenuItemKey | string;
  menuItems: TMenuItems;
  apps: IAppMenuItem[];
  [ENavName.TopNav]: IMenu;
  [ENavName.BottomNav]: IMenu;
}

class SideNavViews extends ViewHandler<ISideNavServiceState> {
  get isOpen() {
    return this.state.isOpen;
  }

  get compactView() {
    return this.state.compactView;
  }

  get menuItemStatus() {
    return this.state[ENavName.TopNav].menuItems.reduce((menuItems, menuItem) => {
      return { ...menuItems, [menuItem.key]: menuItem.isActive };
    }, {});
  }

  get hasLegacyMenu() {
    return this.state.hasLegacyMenu;
  }

  get currentMenuItem() {
    return this.state.currentMenuItem;
  }

  get apps() {
    return this.state.apps;
  }

  get showCustomEditor() {
    return this.state.showCustomEditor;
  }

  getExpandedMenuItems(name: ENavName) {
    if (!name) return;
    return this.state[name].menuItems.reduce((keys, menuItem: IMenuItem) => {
      if (menuItem.isExpanded) {
        keys.push(menuItem.key);
      }
      return keys;
    }, []);
  }

  getMenuItemData(name: ENavName, menuItemKey: EMenuItemKey) {
    return this.state[name].menuItems.find(item => item.key === menuItemKey);
  }
}

@InitAfter('UserService')
export class SideNavService extends PersistentStatefulService<ISideNavServiceState> {
  @Inject() userService: UserService;
  @Inject() appService: AppService;
  @Inject() dismissablesService: DismissablesService;
  @Inject() layoutService: LayoutService;

  static defaultState: ISideNavServiceState = {
    isOpen: false,
    showCustomEditor: true,
    hasLegacyMenu: true,
    currentMenuItem: EMenuItemKey.Editor,
    compactView: false,
    menuItems: SideNavMenuItems(),
    apps: [null, null, null, null, null], // up to five apps may be displayed in the closed sidebar
    [ENavName.TopNav]: SideBarTopNavData(),
    [ENavName.BottomNav]: SideBarBottomNavData(),
  };

  init() {
    super.init();
    this.userService.userLoginFinished.subscribe(() => this.handleUserLogin());

    this.handleDismissables();

    this.state.currentMenuItem =
      this.layoutService.state.currentTab !== 'default'
        ? this.layoutService.state.currentTab
        : EMenuItemKey.Editor;
  }

  get views() {
    return new SideNavViews(this.state);
  }

  toggleMenuStatus() {
    this.OPEN_CLOSE_MENU();
  }

  setCurrentMenuItem(key: EMenuItemKey | string) {
    this.SET_CURRENT_MENU_ITEM(key);
  }

  setCompactView(isCompact: boolean) {
    this.SET_COMPACT_VIEW(isCompact);
  }

  handleUserLogin() {
    const registrationDate = this.userService.state.createdAt;

    // TODO: set Date to specific date
    const legacyMenu = registrationDate < new Date('December 8, 2022').valueOf();

    if (!legacyMenu && !this.state.compactView) {
      if (!this.state.compactView) {
        this.SET_NEW_USER_LOGIN();
      }
    } else if (
      this.state.hasLegacyMenu &&
      this.dismissablesService.views.shouldShow(EDismissable.NewSideNav)
    ) {
      this.SET_LEGACY_VIEW();
    }

    this.dismissablesService.dismiss(EDismissable.LoginPrompt);
  }

  handleDismissables() {
    const loggedIn = this.userService.views.isLoggedIn;
    const registrationDate = this.userService.state.createdAt;
    const legacyMenu = registrationDate < new Date('December 8, 2022').valueOf();

    if (loggedIn) {
      this.dismissablesService.dismiss(EDismissable.LoginPrompt);
      if (legacyMenu && !this.appService.state.onboarded) {
        // show for legacy user's first startup after new side nav date
        this.dismissablesService.views.shouldShow(EDismissable.NewSideNav);
        this.dismissablesService.views.shouldShow(EDismissable.CustomMenuSettings);
      } else {
        this.dismissablesService.dismiss(EDismissable.NewSideNav);
        this.dismissablesService.dismiss(EDismissable.CustomMenuSettings);
      }
    } else {
      // the user is not logged in
      if (legacyMenu) {
        this.dismissablesService.dismiss(EDismissable.LoginPrompt);
        if (!this.appService.state.onboarded) {
          this.dismissablesService.views.shouldShow(EDismissable.NewSideNav);
          this.dismissablesService.views.shouldShow(EDismissable.CustomMenuSettings);
        } else {
          this.dismissablesService.dismiss(EDismissable.NewSideNav);
          this.dismissablesService.dismiss(EDismissable.CustomMenuSettings);
        }
      } else {
        if (this.state.hasLegacyMenu) {
          // this is a new user opening the app for the first time
          this.state.hasLegacyMenu = false;
        }
        this.dismissablesService.views.shouldShow(EDismissable.LoginPrompt);
        this.dismissablesService.dismiss(EDismissable.NewSideNav);
        this.dismissablesService.dismiss(EDismissable.CustomMenuSettings);
      }
    }
  }

  expandMenuItem(navName: ENavName, key: EMenuItemKey) {
    // expand/contract menu items
    this.EXPAND_MENU_ITEM(navName, key);
  }

  toggleSidebarSubmenu(status?: boolean) {
    // show/hide submenus shown at the parent level
    this.TOGGLE_SIDEBAR_SUBMENU(status);
  }

  toggleMenuItem(navName: ENavName, menuItemKey: EMenuItemKey, status?: boolean) {
    // show/hide menu items
    this.TOGGLE_MENU_ITEM(navName, menuItemKey, status);
  }

  toggleApp(appId: string) {
    // show hide apps in menu
    this.TOGGLE_APP(appId);
  }

  replaceApp(newApp: IAppMenuItem, index: number) {
    // add/update apps
    this.REPLACE_APP(newApp, index);
  }

  @mutation()
  private SET_COMPACT_VIEW(isCompact: boolean) {
    this.state = { ...this.state, compactView: isCompact };
  }

  @mutation()
  private SET_NEW_USER_LOGIN() {
    // compact view with menu items expanded
    this.state.isOpen = true;
    this.state.hasLegacyMenu = false;

    this.state[ENavName.TopNav] = {
      ...this.state[ENavName.TopNav],
      menuItems: [
        { ...SideNavMenuItems()[EMenuItemKey.Editor], isActive: true },
        { ...SideNavMenuItems()[EMenuItemKey.LayoutEditor], isActive: false },
        { ...SideNavMenuItems()[EMenuItemKey.StudioMode], isActive: false },
        { ...SideNavMenuItems()[EMenuItemKey.Themes], isActive: true },
        { ...SideNavMenuItems()[EMenuItemKey.AppStore], isActive: true },
        { ...SideNavMenuItems()[EMenuItemKey.Highlighter], isActive: true },
        { ...SideNavMenuItems()[EMenuItemKey.ThemeAudit], isActive: true },
      ],
    };

    this.state[ENavName.BottomNav] = {
      ...this.state[ENavName.BottomNav],
      menuItems: this.state[ENavName.BottomNav].menuItems.map((menuItem: IMenuItem) => {
        if (menuItem.key === EMenuItemKey.Dashboard) {
          return { ...this.state.menuItems[EMenuItemKey.Dashboard], isExpanded: true };
        }
        return menuItem;
      }),
    };
  }

  @mutation()
  private SET_LEGACY_VIEW() {
    this.state.showCustomEditor = true;
    this.state.compactView = false;

    this.state.menuItems = {
      ...this.state.menuItems,
      [EMenuItemKey.Editor]: { ...this.state.menuItems[EMenuItemKey.Editor], isActive: true },
      [EMenuItemKey.Themes]: { ...this.state.menuItems[EMenuItemKey.Themes], isActive: true },
      [EMenuItemKey.AppStore]: { ...this.state.menuItems[EMenuItemKey.AppStore], isActive: true },
      [EMenuItemKey.Highlighter]: {
        ...this.state.menuItems[EMenuItemKey.Highlighter],
        isActive: true,
      },
      [EMenuItemKey.LayoutEditor]: {
        ...this.state.menuItems[EMenuItemKey.LayoutEditor],
        isActive: true,
      },
      [EMenuItemKey.StudioMode]: {
        ...this.state.menuItems[EMenuItemKey.StudioMode],
        isActive: true,
      },
      [EMenuItemKey.ThemeAudit]: {
        ...this.state.menuItems[EMenuItemKey.ThemeAudit],
        isActive: true,
      },
    };

    this.state[ENavName.TopNav] = {
      ...this.state[ENavName.TopNav],
      menuItems: [
        { ...this.state.menuItems[EMenuItemKey.Editor], isActive: true },
        { ...this.state.menuItems[EMenuItemKey.LayoutEditor], isActive: true },
        { ...this.state.menuItems[EMenuItemKey.StudioMode], isActive: true },
        { ...this.state.menuItems[EMenuItemKey.Themes], isActive: true },
        { ...this.state.menuItems[EMenuItemKey.AppStore], isActive: true },
        { ...this.state.menuItems[EMenuItemKey.Highlighter], isActive: true },
        { ...this.state.menuItems[EMenuItemKey.ThemeAudit], isActive: true },
      ],
    };
  }

  @mutation()
  private OPEN_CLOSE_MENU() {
    this.state.isOpen = !this.state.isOpen;
  }

  @mutation()
  private TOGGLE_SIDEBAR_SUBMENU(status?: boolean) {
    // currently only the custom editor needs to
    // have the option to show/hide in the sidebar
    if (status) {
      this.state.showCustomEditor = status;
    } else {
      this.state.showCustomEditor = !this.state.showCustomEditor;
    }

    if (!this.state.showCustomEditor) {
      this.state.currentMenuItem = EMenuItemKey.Editor;
    }
  }

  @mutation()
  private TOGGLE_MENU_ITEM(navName: ENavName, menuItemKey: EMenuItemKey, status?: boolean) {
    // toggle boolean value
    if (status) {
      this.state[navName].menuItems.find(
        (menuItem: IMenuItem) => menuItem.key === menuItemKey,
      ).isActive = status;
    }
    this.state[navName].menuItems.find(
      (menuItem: IMenuItem) => menuItem.key === menuItemKey,
    ).isActive = !this.state[navName].menuItems.find(
      (menuItem: IMenuItem) => menuItem.key === menuItemKey,
    ).isActive;
  }

  @mutation()
  private TOGGLE_APP(appId: string) {
    this.state.apps = this.state.apps.map(app => {
      if (!app) return null;

      if (app.id === appId) {
        return { ...app, isActive: !app.isActive };
      }

      return app;
    });
  }

  @mutation()
  private REPLACE_APP(newApp: IAppMenuItem, index: number) {
    const updatedApps = this.state.apps.map((app, i) => {
      if (i === index) return newApp;

      if (!app || app?.id === newApp.id) {
        // if the new app is already in the array, remove it
        return null;
      }

      return app;
    });
    this.state.apps = updatedApps;
  }

  @mutation()
  private EXPAND_MENU_ITEM(navName: ENavName, key: EMenuItemKey) {
    // toggle boolean value
    this.state[navName] = {
      ...this.state[navName],
      menuItems: [
        ...this.state[navName].menuItems.map(menuItem => {
          if (menuItem.key === key) {
            return { ...menuItem, isExpanded: !menuItem.isExpanded };
          }
          return menuItem;
        }),
      ],
    };
  }

  @mutation()
  private SET_CURRENT_MENU_ITEM(key: EMenuItemKey | string) {
    this.state.currentMenuItem = key;
  }
}
