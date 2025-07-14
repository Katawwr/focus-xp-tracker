(function() {
  // Don't run on extension pages
  if (window.location.protocol === 'chrome-extension:') return;
  
  // XP values for different actions
  const XP_VALUES = {
    click: 2,
    typing: 3,
    scroll: 1
  };

  // Create XP bar container
  const xpContainer = document.createElement('div');
  xpContainer.className = 'xp-tracker-container';
  xpContainer.innerHTML = `
    <div class="xp-bar-wrapper">
      <div class="level-display">
        <span class="skill-icon">⚡</span>
        <span class="level-text">Focus</span>
        <span class="level-number">1</span>
      </div>
      <div class="xp-bar">
        <div class="xp-fill"></div>
        <div class="xp-text">0 / 83</div>
      </div>
    </div>
    <div class="xp-drops"></div>
  `;
  document.body.appendChild(xpContainer);

  // State management
  let currentTracker = 'Focus';
  let trackers = {};
  let globalSettings = {
    isPaused: false,
    showXpDrops: true,
    showLevelUp: true,
    showGoldenTrim: true,
    blockedSites: []
  };
  let currentLevel = 1;
  let typingCounter = 0;
  let scrollCooldown = false;
  let isBlockedSite = false;

  // UI elements
  const levelText = xpContainer.querySelector('.level-text');
  const levelNumber = xpContainer.querySelector('.level-number');
  const xpFill = xpContainer.querySelector('.xp-fill');
  const xpText = xpContainer.querySelector('.xp-text');
  const wrapper = xpContainer.querySelector('.xp-bar-wrapper');
  const dropsContainer = xpContainer.querySelector('.xp-drops');

  // Dragging functionality
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let currentPos = { x: 20, y: 20 };

  // Check if current site is blocked and update display visibility
  function checkIfBlocked() {
    const hostname = window.location.hostname.toLowerCase();
    isBlockedSite = false;
    
    if (globalSettings.blockedSites && globalSettings.blockedSites.length > 0) {
      for (let site of globalSettings.blockedSites) {
        if (hostname.includes(site.toLowerCase())) {
          isBlockedSite = true;
          break;
        }
      }
    }
    
    updateDisplayVisibility();
  }

  // Update display visibility based on paused state and blocked status
  function updateDisplayVisibility() {
    if (globalSettings.isPaused) {
      // Hide completely when paused
      xpContainer.style.display = 'none';
    } else {
      // Show and set appropriate opacity
      xpContainer.style.display = 'block';
      wrapper.style.opacity = isBlockedSite ? '0.5' : '1';
    }
  }

  // Load saved position
  chrome.storage.local.get(['trackerPosition'], (data) => {
    if (data.trackerPosition) {
      currentPos = data.trackerPosition;
      xpContainer.style.right = currentPos.x + 'px';
      xpContainer.style.bottom = currentPos.y + 'px';
    }
  });

  // Make entire wrapper draggable
  wrapper.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX + currentPos.x;
    dragStartY = e.clientY + currentPos.y;
    wrapper.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      currentPos.x = dragStartX - e.clientX;
      currentPos.y = dragStartY - e.clientY;
      
      currentPos.x = Math.max(0, Math.min(window.innerWidth - 300, currentPos.x));
      currentPos.y = Math.max(0, Math.min(window.innerHeight - 100, currentPos.y));
      
      xpContainer.style.right = currentPos.x + 'px';
      xpContainer.style.bottom = currentPos.y + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      wrapper.style.cursor = 'grab';
      chrome.storage.local.set({ trackerPosition: currentPos });
    }
  });

  // Load saved data
  function loadData() {
    chrome.storage.local.get(['trackers', 'currentTracker', 'globalSettings'], (data) => {
      // Always use latest trackers
      if (data.trackers && Object.keys(data.trackers).length > 0) {
        trackers = data.trackers;
      } else {
        trackers = { 'Focus': { totalXp: 0, sessionXp: 0 } };
        chrome.storage.local.set({ trackers });
      }

      // Always use latest currentTracker
      if (data.currentTracker && trackers[data.currentTracker]) {
        currentTracker = data.currentTracker;
      } else {
        currentTracker = Object.keys(trackers)[0] || 'Focus';
        chrome.storage.local.set({ currentTracker });
      }
      levelText.textContent = currentTracker;

      // Always use latest globalSettings
      if (data.globalSettings) {
        globalSettings = Object.assign({
          isPaused: false,
          showXpDrops: true,
          showLevelUp: true,
          showGoldenTrim: true,
          blockedSites: []
        }, data.globalSettings);
      } else {
        globalSettings = {
          isPaused: false,
          showXpDrops: true,
          showLevelUp: true,
          showGoldenTrim: true,
          blockedSites: []
        };
        chrome.storage.local.set({ globalSettings });
      }

      if (!trackers[currentTracker]) {
        trackers[currentTracker] = { totalXp: 0, sessionXp: 0 };
        chrome.storage.local.set({ trackers });
      }

      checkIfBlocked();
      updateXpBar();
    });
  }

  // Listen for storage changes and update everything
  chrome.storage.onChanged.addListener((changes) => {
    let needsVisibilityUpdate = false;
    let needsBarUpdate = false;
    if (changes.trackers) {
      trackers = changes.trackers.newValue || {};
      // If currentTracker was deleted, pick a new one
      if (!trackers[currentTracker]) {
        currentTracker = Object.keys(trackers)[0] || 'Focus';
        chrome.storage.local.set({ currentTracker });
      }
      needsBarUpdate = true;
    }
    if (changes.currentTracker) {
      currentTracker = changes.currentTracker.newValue;
      levelText.textContent = currentTracker;
      currentLevel = 0;
      needsBarUpdate = true;
      needsVisibilityUpdate = true;
    }
    if (changes.globalSettings) {
      globalSettings = Object.assign({
        isPaused: false,
        showXpDrops: true,
        showLevelUp: true,
        showGoldenTrim: true,
        blockedSites: []
      }, changes.globalSettings.newValue || {});
      needsVisibilityUpdate = true;
      needsBarUpdate = true;
    }
    if (needsVisibilityUpdate) updateDisplayVisibility();
    if (needsBarUpdate) updateXpBar();
  });

  // Calculate XP required for level
  function getXpForLevel(level) {
    let points = 0;
    let output = 0;
    
    for (let lvl = 1; lvl < level; lvl++) {
      points += Math.floor(lvl + 300 * Math.pow(2, lvl / 3));
      output = Math.floor(points / 4);
    }
    
    return output;
  }

  // Get current level from XP
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

  // Create XP drop animation
  function createXpDrop(amount, type) {
    if (!globalSettings.showXpDrops) return;
    
    const drop = document.createElement('div');
    drop.className = `xp-drop xp-drop-${type}`;
    drop.textContent = `+${amount}`;
    dropsContainer.appendChild(drop);
    
    // Force reflow
    drop.offsetHeight;
    
    requestAnimationFrame(() => {
      drop.style.transform = 'translateY(-30px)';
      drop.style.opacity = '0';
    });
    
    setTimeout(() => {
      drop.remove();
    }, 1000);
  }

  // Get golden trim style
  function getGoldenTrimStyle(xp) {
    if (!globalSettings.showGoldenTrim) return '';
    
    if (xp >= 1e15) return 'golden-trim-legendary';
    if (xp >= 1e12) return 'golden-trim-epic';
    if (xp >= 1e9) return 'golden-trim-rare';
    if (xp >= 1e6) return 'golden-trim-uncommon';
    if (xp >= 1e3) return 'golden-trim-common';
    return '';
  }

  // Update XP bar display
  function updateXpBar() {
    if (!trackers[currentTracker]) {
      trackers[currentTracker] = { totalXp: 0, sessionXp: 0 };
    }
    
    const tracker = trackers[currentTracker];
    const newLevel = getLevelFromXp(tracker.totalXp);
    const currentLevelXp = getXpForLevel(newLevel);
    const nextLevelXp = getXpForLevel(newLevel + 1);
    const progressXp = tracker.totalXp - currentLevelXp;
    const neededXp = nextLevelXp - currentLevelXp;
    const percentage = Math.min((progressXp / neededXp) * 100, 100);
    
    // Check for level up
    if (newLevel > currentLevel && currentLevel > 0 && globalSettings.showLevelUp) {
      createLevelUpAnimation(newLevel);
    }
    currentLevel = newLevel;
    
    // Update UI
    levelNumber.textContent = formatNumber(newLevel);
    xpFill.style.width = `${percentage}%`;
    
    // Update progress bar color
    let color;
    if (percentage < 25) {
      color = '#ff4444';
    } else if (percentage < 50) {
      color = '#ff8844';
    } else if (percentage < 75) {
      color = '#ffcc00';
    } else {
      color = '#00ff00';
    }
    xpFill.style.background = color;
    
    xpText.textContent = `${formatNumber(progressXp)} / ${formatNumber(neededXp)}`;
    
    // Apply golden trim
    wrapper.className = 'xp-bar-wrapper';
    const trimClass = getGoldenTrimStyle(tracker.totalXp);
    if (trimClass) {
      wrapper.classList.add(trimClass);
    }
  }

  // Level up animation
  function createLevelUpAnimation(newLevel) {
    const levelUp = document.createElement('div');
    levelUp.className = 'level-up';
    levelUp.innerHTML = `
      <div class="level-up-text">LEVEL UP!</div>
      <div class="level-up-skill">${currentTracker} Level ${formatNumber(newLevel)}</div>
    `;
    document.body.appendChild(levelUp);
    
    requestAnimationFrame(() => {
      levelUp.style.opacity = '1';
    });
    
    setTimeout(() => {
      levelUp.style.opacity = '0';
    }, 2500);
    
    setTimeout(() => {
      levelUp.remove();
    }, 3000);
  }

  // Format large numbers
  function formatNumber(num) {
    if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  }

  // Add XP
  function addXp(amount, type) {
    if (globalSettings.isPaused || isBlockedSite) return;
    
    if (!trackers[currentTracker]) {
      trackers[currentTracker] = { totalXp: 0, sessionXp: 0 };
    }
    
    const tracker = trackers[currentTracker];
    tracker.totalXp += amount;
    tracker.sessionXp += amount;
    
    // Save to storage
    chrome.storage.local.set({ trackers });
    
    createXpDrop(amount, type);
    updateXpBar();
  }

  // Event listeners
  document.addEventListener('click', (e) => {
    if (e.target.closest('.xp-tracker-container')) return;
    addXp(XP_VALUES.click, 'click');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typingCounter++;
      if (typingCounter >= 10) {
        typingCounter = 0;
        addXp(XP_VALUES.typing, 'typing');
      }
    }
  });

  document.addEventListener('wheel', () => {
    if (scrollCooldown) return;
    
    scrollCooldown = true;
    addXp(XP_VALUES.scroll, 'scroll');
    
    setTimeout(() => {
      scrollCooldown = false;
    }, 2000);
  });

  // Initialize
  loadData();
})();