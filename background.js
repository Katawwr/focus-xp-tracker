chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage
  chrome.storage.local.get(['totalXp'], (data) => {
    if (!data.totalXp) {
      chrome.storage.local.set({ totalXp: 0, sessionXp: 0 });
    }
  });
});

// Reset session XP when browser starts
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ sessionXp: 0 });
});