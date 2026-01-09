// Background service worker for Side Panel

// 当用户点击插件图标时，打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  // 打开侧边栏
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 插件安装时打开侧边栏（可选）
chrome.runtime.onInstalled.addListener(async () => {
  // 可以在这里做一些初始化工作
});
