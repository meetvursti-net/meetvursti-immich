import { browser } from '$app/environment';

// Check if it's a mobile device
const isMobileDevice = () => {
  if (!browser) {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
};

// Session-only state for detail panel - defaults to true on desktop
const getInitialDetailPanelState = () => {
  if (!browser) {
    return true;
  }
  // Check if it's a desktop device (not a touch device and wide enough)
  const isDesktop = !window.matchMedia('(pointer: coarse)').matches && window.innerWidth >= 768;
  return isDesktop;
};

class DetailPanelState {
  #value = $state(getInitialDetailPanelState());

  get current() {
    return this.#value;
  }

  set current(value: boolean) {
    this.#value = value;
  }
}

const isShowDetailPanel = new DetailPanelState();

export class AssetViewerManager {
  isShowActivityPanel = $state(false);
  isPlayingMotionPhoto = $state(false);

  get isShowDetailPanel() {
    return isShowDetailPanel.current;
  }

  private set isShowDetailPanel(value: boolean) {
    isShowDetailPanel.current = value;
  }

  toggleActivityPanel() {
    this.closeDetailPanel();
    this.isShowActivityPanel = !this.isShowActivityPanel;
  }

  closeActivityPanel() {
    this.isShowActivityPanel = false;
  }

  toggleDetailPanel() {
    this.closeActivityPanel();
    this.isShowDetailPanel = !this.isShowDetailPanel;
  }

  closeDetailPanel() {
    this.isShowDetailPanel = false;
  }

  // Reset detail panel state for mobile when opening a new asset
  resetForNewAsset() {
    if (isMobileDevice()) {
      this.isShowDetailPanel = false;
    }
  }
}

export const assetViewerManager = new AssetViewerManager();
