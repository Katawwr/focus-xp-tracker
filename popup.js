document.addEventListener('DOMContentLoaded', async () => {
  console.log('Focus XP Tracker Popup: Loaded');
  
  // Elements
  const trackerSelect = document.getElementById('trackerSelect');
  const manageTrackersBtn = document.getElementById('manageTrackers');
  const levelEl = document.getElementById('level');
  const totalXpEl = document.getElementById('totalXp');
  const sessionXpEl = document.getElementById('sessionXp');
  const statusEl = document.getElementById('status');
  const resetBtn = document.getElementById('reset');
  const pauseToggleBtn = document.getElementById('pauseToggle');
  const viewStatsBtn = document.getElementById('viewStats');
  const showXpDropsCheckbox = document.getElementById('showXpDrops');
  const showLevelUpCheckbox = document.getElementById('showLevelUp');
  const showGoldenTrimCheckbox = document.getElementById('showGoldenTrim');
  const blockedSitesList = document.getElementById('blockedSites');
  const newSiteInput = document.getElementById('newSite');
  const addSiteBtn = document.getElementById('addSite');
  
  // Modals
  const trackerModal = document.getElementById('trackerModal');
  const statsModal = document.getElementById('statsModal');
  const closeModalBtn = document.getElementById('closeModal');
  const closeStatsModalBtn = document.getElementById('closeStatsModal');
  const trackerList = document.getElementById('trackerList');
  const newTrackerInput = document.getElementById('newTrackerName');
  const addTrackerBtn = document.getElementById('addTracker');
  const allStatsDiv = document.getElementById('allStats');

  let currentTracker = 'Focus';
  let trackers = {};
  let globalSettings = {};

  // Initialize or load data
  async function loadData() {
    const data = await chrome.storage.local.get(['trackers', 'currentTracker', 'globalSettings']);
    console.log('Focus XP Tracker Popup: Loaded data:', data);

    // Initialize trackers if not exists
    if (!data.trackers || Object.keys(data.trackers).length === 0) {
      trackers = {
        'Focus': {
          totalXp: 0,
          sessionXp: 0
        }
      };
      await chrome.storage.local.set({ trackers });
      console.log('Focus XP Tracker Popup: Initialized default tracker');
    } else {
      trackers = data.trackers;
    }

    // Set current tracker
    if (data.currentTracker && trackers[data.currentTracker]) {
      currentTracker = data.currentTracker;
    } else {
      currentTracker = Object.keys(trackers)[0] || 'Focus';
      await chrome.storage.local.set({ currentTracker });
    }

    // Load global settings with defaults, but don't overwrite existing settings
    globalSettings = Object.assign({
      isPaused: false,
      showXpDrops: true,
      showLevelUp: true,
      showGoldenTrim: true,
      blockedSites: []
    }, data.globalSettings);
    if (!data.globalSettings) {
      await chrome.storage.local.set({ globalSettings });
    }

    updateTrackerDropdown();
    updateBlockedSitesList();
    updateUI();
  }

  // Update tracker dropdown
  function updateTrackerDropdown() {
    trackerSelect.innerHTML = '';
    Object.keys(trackers).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === currentTracker) {
        option.selected = true;
      }
      trackerSelect.appendChild(option);
    });
  }

  // Update UI with current tracker data
  function updateUI() {
    const tracker = trackers[currentTracker] || { totalXp: 0, sessionXp: 0 };
    const level = getLevelFromXp(tracker.totalXp);
    
    levelEl.textContent = formatNumber(level);
    totalXpEl.textContent = formatNumber(tracker.totalXp);
    sessionXpEl.textContent = formatNumber(tracker.sessionXp);
    
    statusEl.textContent = globalSettings.isPaused ? 'Paused' : 'Tracking';
    statusEl.style.color = globalSettings.isPaused ? '#ff9999' : '#99ff99';
    pauseToggleBtn.textContent = globalSettings.isPaused ? 'Resume Tracking' : 'Pause Tracking';
    pauseToggleBtn.classList.toggle('paused', globalSettings.isPaused);
    
    showXpDropsCheckbox.checked = globalSettings.showXpDrops !== false;
    showLevelUpCheckbox.checked = globalSettings.showLevelUp !== false;
    showGoldenTrimCheckbox.checked = globalSettings.showGoldenTrim !== false;
    
    updateBlockedSitesList();
  }

  // Display blocked sites
  function updateBlockedSitesList() {
    blockedSitesList.innerHTML = '';
    if (!globalSettings.blockedSites || globalSettings.blockedSites.length === 0) {
      blockedSitesList.innerHTML = '<div style="color: #888; font-size: 12px;">No blocked sites</div>';
    } else {
      globalSettings.blockedSites.forEach((site, index) => {
        const siteEl = document.createElement('div');
        siteEl.className = 'blocked-site';
        siteEl.innerHTML = `
          <span>${site}</span>
          <button class="remove-site" data-index="${index}">Remove</button>
        `;
        blockedSitesList.appendChild(siteEl);
      });
    }
  }

  // Listen for storage changes to update UI
  chrome.storage.onChanged.addListener((changes) => {
    console.log('Focus XP Tracker Popup: Storage changed:', changes);
    chrome.storage.local.get(['trackers', 'currentTracker', 'globalSettings'], (data) => {
      trackers = data.trackers || {};
      currentTracker = data.currentTracker || Object.keys(trackers)[0] || 'Focus';
      globalSettings = Object.assign({
        isPaused: false,
        showXpDrops: true,
        showLevelUp: true,
        showGoldenTrim: true,
        blockedSites: []
      }, data.globalSettings);
      updateTrackerDropdown();
      updateBlockedSitesList();
      updateUI();
    });
  });

  // Tracker selector change
  trackerSelect.addEventListener('change', async () => {
    currentTracker = trackerSelect.value;
    console.log('Focus XP Tracker Popup: Switching to tracker:', currentTracker);
    await chrome.storage.local.set({ currentTracker });
    // UI will update via storage event
  });

  // Manage trackers modal
  manageTrackersBtn.addEventListener('click', () => {
    updateTrackerList();
    trackerModal.style.display = 'flex';
  });

  function updateTrackerList() {
    trackerList.innerHTML = '';
    Object.keys(trackers).forEach(name => {
      const item = document.createElement('div');
      item.className = 'tracker-item';
      item.innerHTML = `
        <span class="tracker-name">${name}</span>
        ${Object.keys(trackers).length > 1 ? `<button class="delete-tracker" data-name="${name}">Delete</button>` : ''}
      `;
      trackerList.appendChild(item);
    });
  }

  // Add new tracker
  addTrackerBtn.addEventListener('click', async () => {
    const name = newTrackerInput.value.trim();
    if (name && !trackers[name]) {
      // Always get latest trackers from storage before writing
      const data = await chrome.storage.local.get('trackers');
      const latestTrackers = Object.assign({}, data.trackers || trackers);
      latestTrackers[name] = { totalXp: 0, sessionXp: 0 };
      await chrome.storage.local.set({ trackers: latestTrackers });
      console.log('Focus XP Tracker Popup: Added tracker:', name);
      newTrackerInput.value = '';
      // UI will update via storage event
    }
  });

  // Delete tracker
  trackerList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-tracker')) {
      const name = e.target.dataset.name;
      if (Object.keys(trackers).length > 1) {
        // Always get latest trackers from storage before writing
        const data = await chrome.storage.local.get(['trackers', 'currentTracker']);
        const latestTrackers = Object.assign({}, data.trackers || trackers);
        delete latestTrackers[name];
        let newCurrent = data.currentTracker;
        if (newCurrent === name) {
          newCurrent = Object.keys(latestTrackers)[0] || 'Focus';
        }
        await chrome.storage.local.set({ trackers: latestTrackers, currentTracker: newCurrent });
        console.log('Focus XP Tracker Popup: Deleted tracker:', name);
        // UI will update via storage event
      }
    }
  });

  // View all stats
  viewStatsBtn.addEventListener('click', () => {
    updateAllStats();
    statsModal.style.display = 'flex';
  });

  function updateAllStats() {
    allStatsDiv.innerHTML = '';
    
    // Calculate master stats
    let totalMasterXp = 0;
    const trackerStats = [];
    
    Object.entries(trackers).forEach(([name, data]) => {
      totalMasterXp += data.totalXp;
      trackerStats.push({ name, xp: data.totalXp, level: getLevelFromXp(data.totalXp) });
    });
    
    // Add master stat
    const masterLevel = getLevelFromXp(totalMasterXp);
    const masterItem = document.createElement('div');
    masterItem.className = 'stat-item';
    masterItem.style.background = '#4a3a2a';
    masterItem.style.border = '2px solid #ffcc00';
    masterItem.innerHTML = `
      <div class="stat-item-name" style="color: #ffcc00; font-size: 16px;">TOTAL STATS</div>
      <div class="stat-item-details">
        <span>Level ${formatNumber(masterLevel)}</span>
        <span>${formatNumber(totalMasterXp)} XP</span>
      </div>
    `;
    allStatsDiv.appendChild(masterItem);
    
    // Add individual tracker stats
    trackerStats.forEach(({ name, xp, level }) => {
      const item = document.createElement('div');
      item.className = 'stat-item';
      item.innerHTML = `
        <div class="stat-item-name">${name}</div>
        <div class="stat-item-details">
          <span>Level ${formatNumber(level)}</span>
          <span>${formatNumber(xp)} XP</span>
        </div>
      `;
      allStatsDiv.appendChild(item);
    });
  }

  // Close modals
  closeModalBtn.addEventListener('click', () => {
    trackerModal.style.display = 'none';
  });

  closeStatsModalBtn.addEventListener('click', () => {
    statsModal.style.display = 'none';
  });

  // Settings handlers - Fixed to properly save
  showXpDropsCheckbox.addEventListener('change', async () => {
    const data = await chrome.storage.local.get('globalSettings');
    const settings = Object.assign({
      isPaused: false,
      showXpDrops: true,
      showLevelUp: true,
      showGoldenTrim: true,
      blockedSites: []
    }, data.globalSettings);
    settings.showXpDrops = showXpDropsCheckbox.checked;
    await chrome.storage.local.set({ globalSettings: settings });
    // UI will update via storage event
  });
  showLevelUpCheckbox.addEventListener('change', async () => {
    const data = await chrome.storage.local.get('globalSettings');
    const settings = Object.assign({
      isPaused: false,
      showXpDrops: true,
      showLevelUp: true,
      showGoldenTrim: true,
      blockedSites: []
    }, data.globalSettings);
    settings.showLevelUp = showLevelUpCheckbox.checked;
    await chrome.storage.local.set({ globalSettings: settings });
  });
  showGoldenTrimCheckbox.addEventListener('change', async () => {
    const data = await chrome.storage.local.get('globalSettings');
    const settings = Object.assign({
      isPaused: false,
      showXpDrops: true,
      showLevelUp: true,
      showGoldenTrim: true,
      blockedSites: []
    }, data.globalSettings);
    settings.showGoldenTrim = showGoldenTrimCheckbox.checked;
    await chrome.storage.local.set({ globalSettings: settings });
  });

  // Blocked sites add/remove
  addSiteBtn.addEventListener('click', async () => {
    const site = newSiteInput.value.trim().toLowerCase();
    if (site) {
      const data = await chrome.storage.local.get('globalSettings');
      const settings = Object.assign({
        isPaused: false,
        showXpDrops: true,
        showLevelUp: true,
        showGoldenTrim: true,
        blockedSites: []
      }, data.globalSettings);
      if (!settings.blockedSites.includes(site)) {
        settings.blockedSites.push(site);
        await chrome.storage.local.set({ globalSettings: settings });
        newSiteInput.value = '';
      }
    }
  });
  blockedSitesList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('remove-site')) {
      const index = parseInt(e.target.dataset.index);
      const data = await chrome.storage.local.get('globalSettings');
      const settings = Object.assign({
        isPaused: false,
        showXpDrops: true,
        showLevelUp: true,
        showGoldenTrim: true,
        blockedSites: []
      }, data.globalSettings);
      settings.blockedSites.splice(index, 1);
      await chrome.storage.local.set({ globalSettings: settings });
    }
  });

  // Pause/Resume tracking
  pauseToggleBtn.addEventListener('click', async () => {
    // Always get latest settings from storage before modifying
    const data = await chrome.storage.local.get(['globalSettings', 'trackers']);
    const settings = Object.assign({
      isPaused: false,
      showXpDrops: true,
      showLevelUp: true,
      showGoldenTrim: true,
      blockedSites: []
    }, data.globalSettings);
    
    settings.isPaused = !settings.isPaused;
    
    if (settings.isPaused) {
      // Pausing ends all sessions
      const latestTrackers = Object.assign({}, data.trackers || trackers);
      Object.keys(latestTrackers).forEach(name => {
        latestTrackers[name].sessionXp = 0;
      });
      await chrome.storage.local.set({ trackers: latestTrackers, globalSettings: settings });
    } else {
      await chrome.storage.local.set({ globalSettings: settings });
    }
    
    console.log('Focus XP Tracker Popup: Toggled pause:', settings.isPaused);
    // UI will update via storage event
  });

  // Reset current tracker
  resetBtn.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to reset ${currentTracker} progress?`)) {
      // Always get latest trackers from storage before modifying
      const data = await chrome.storage.local.get('trackers');
      const latestTrackers = Object.assign({}, data.trackers || trackers);
      latestTrackers[currentTracker] = { totalXp: 0, sessionXp: 0 };
      await chrome.storage.local.set({ trackers: latestTrackers });
      console.log('Focus XP Tracker Popup: Reset tracker:', currentTracker);
      // UI will update via storage event
    }
  });

  // Helper functions - MUCH harder leveling
  function getLevelFromXp(xp) {
    let level = 1;
    let points = 0;
    let output = 0;
    
    for (level = 1; level < 200; level++) {
      points += Math.floor(level + 300 * Math.pow(2, level / 3));
      output = Math.floor(points / 4);
      
      if (output > xp) {
        return level;
      }
    }
    
    return level;
  }

  function formatNumber(num) {
    if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  }

  // Initialize
  loadData();
});