/**
 * Facebook Feed Filter v1.0.6
 * 精準移除 Facebook 推薦內容、贊助貼文和 Reels
 *
 * 更新內容 (v1.0.6):
 * - 新增工具列 popup，可暫停或恢復首頁過濾
 * - 僅在 Facebook 首頁路徑 / 執行過濾
 * - 支援 SPA 路由切換，離開首頁時立即停止
 * - 關閉過濾時還原目前頁面已移除的內容
 *
 * 更新內容 (v1.0.5):
 * - 改用區域化 microtask 掃描，降低動態貼文的移除延遲
 * - 在畫面繪製前隱藏新版贊助貼文，避免內容短暫閃現
 * - 支援新版 Reel 與「你可能認識的朋友」完整區塊移除
 * - 修正社團推薦貼文和大型 feed unit 的容器選取
 *
 * 更新內容 (v1.0.4):
 * - 支援解析 aria-labelledby 內的隱藏贊助標記
 * - 新增 CTA 型廣告的後備檢測邏輯
 * - 依內容結構評分祖先容器，改為移除完整貼文
 * - 修正大型廣告只移除中段內容的問題
 *
 * 更新內容 (v1.0.3):
 * - 新增檢測 .html-div > span 中的「為你推薦」標記
 * - 使用完全匹配而非包含，避免誤判正常貼文內容
 * - 優先過濾含有推薦標記的貼文
 * - 支援多語言推薦標記檢測
 *
 * 更新內容 (v1.0.2):
 * - 批次處理 DOM 操作，大幅改善效能
 * - 使用 requestAnimationFrame 優化渲染時機
 * - 漸進式隱藏機制，避免畫面破碎
 * - 智慧管理 MutationObserver，防止連鎖反應
 * - 防抖時間增加到 1000ms，減少執行頻率
 */

(function() {
  'use strict';

  const BUILD_ID = '1.0.6';
  const FILTER_ENABLED_KEY = 'filterEnabled';

  let settingsLoaded = false;
  let extensionEnabled = true;
  let filteringActive = false;
  let lastKnownUrl = window.location.href;

  // Debug mode - 可以設為 true 來查看詳細的過濾決策
  const DEBUG = false;
  if (DEBUG) console.log('[FB Filter] Facebook Feed Filter started - DEBUG MODE ON');

  // 初始化：偵測語言
  if (document.documentElement) {
    document.documentElement.setAttribute('data-fb-feed-filter-build', BUILD_ID);
  }
  console.log(`[FB Filter] 初始化中... build ${BUILD_ID}`);

  // 已處理的元素和容器
  let processedElements = new WeakSet();
  let removedContainers = new WeakSet();
  let removedCount = 0;

  // 按語言組織的關鍵字配置
  const KEYWORDS_BY_LANGUAGE = {
    'zh-TW': {
      follow: ['追蹤'],
      join: ['加入'],
      suggested: ['為你推薦'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['你可能認識的朋友'],
      sponsored: ['贊助'],
      reels: ['Reel', 'Reels', '連續短片'],
      // 排除這些詞彙（表示已經在追蹤或已加入的內容）
      exclude: ['追蹤中', '已加入', '已追蹤'],
      // 移除後的提示文字
      removedText: {
        button: '已移除推薦內容',
        reels: '已移除 Reels',
        sponsored: '已移除贊助內容'
      }
    },
    'zh-CN': {
      follow: ['追踪', '关注'],
      join: ['加入'],
      suggested: ['为你推荐'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['你可能认识的人', '你可能认识的朋友'],
      sponsored: ['赞助'],
      reels: ['Reel', 'Reels', '连续短片'],
      exclude: ['追踪中', '关注中', '已加入', '已关注'],
      removedText: {
        button: '已移除推荐内容',
        reels: '已移除 Reels',
        sponsored: '已移除赞助内容'
      }
    },
    'en': {
      follow: ['Follow'],
      join: ['Join'],
      suggested: ['Suggested for you'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['People You May Know'],
      sponsored: ['Sponsored'],
      reels: ['Reel', 'Reels'],
      exclude: ['Following', 'Followed', 'Joined'],
      removedText: {
        button: 'Removed recommendation',
        reels: 'Removed Reels',
        sponsored: 'Removed sponsored content'
      }
    },
    'ja': {
      follow: ['フォロー', 'フォローする'],
      join: ['参加', '参加する'],
      suggested: ['あなたへのおすすめ'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['知り合いかも'],
      sponsored: ['スポンサー', '広告'],
      reels: ['リール', 'Reel', 'Reels'],
      exclude: ['フォロー中', '参加済み', 'フォロー済み'],
      removedText: {
        button: 'おすすめを削除しました',
        reels: 'リールを削除しました',
        sponsored: 'スポンサーコンテンツを削除しました'
      }
    },
    'ko': {
      follow: ['팔로우', '팔로우하기'],
      join: ['가입', '가입하기'],
      suggested: ['회원님을 위한 추천'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['알 수도 있는 사람'],
      sponsored: ['스폰서', '광고'],
      reels: ['릴스', 'Reel', 'Reels'],
      exclude: ['팔로잉', '가입함', '팔로우 중'],
      removedText: {
        button: '추천 콘텐츠 제거됨',
        reels: '릴스 제거됨',
        sponsored: '스폰서 콘텐츠 제거됨'
      }
    },
    'fr': {
      follow: ['Suivre', "S'abonner"],
      join: ['Rejoindre'],
      suggested: ['Suggéré pour vous'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['Vous connaissez peut-être'],
      sponsored: ['Sponsorisé'],
      reels: ['Reel', 'Reels'],
      exclude: ['Abonné', 'Déjà abonné', 'Suivi'],
      removedText: {
        button: 'Recommandation supprimée',
        reels: 'Reels supprimé',
        sponsored: 'Contenu sponsorisé supprimé'
      }
    },
    'de': {
      follow: ['Folgen', 'Abonnieren'],
      join: ['Beitreten'],
      suggested: ['Für dich vorgeschlagen'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['Personen, die du kennen könntest'],
      sponsored: ['Gesponsert'],
      reels: ['Reel', 'Reels'],
      exclude: ['Abonniert', 'Folge ich', 'Beigetreten'],
      removedText: {
        button: 'Empfehlung entfernt',
        reels: 'Reels entfernt',
        sponsored: 'Gesponserte Inhalte entfernt'
      }
    },
    'es': {
      follow: ['Seguir'],
      join: ['Unirse'],
      suggested: ['Sugerencia para ti'],  // Facebook 的推薦標記（完全匹配）
      peopleSuggestions: ['Personas que quizá conozcas'],
      sponsored: ['Patrocinado', 'Publicidad'],
      reels: ['Reel', 'Reels'],
      exclude: ['Siguiendo', 'Seguido', 'Unido'],
      removedText: {
        button: 'Recomendación eliminada',
        reels: 'Reels eliminado',
        sponsored: 'Contenido patrocinado eliminado'
      }
    }
  };

  // 偵測 Facebook 使用的語言
  function detectFacebookLanguage() {
    // 方法 1: 檢查 html lang 屬性
    const htmlLang = document.documentElement ? document.documentElement.lang : '';

    // 方法 2: 檢查 Facebook 的語言設定（通常在 meta 標籤中）
    const metaLocale = document.querySelector('meta[property="og:locale"]');
    const locale = metaLocale ? metaLocale.content : htmlLang;

    // 處理語言代碼對應
    if (locale) {
      const langCode = locale.toLowerCase();

      // 完整匹配
      if (langCode === 'zh_tw' || langCode === 'zh-tw') return 'zh-TW';
      if (langCode === 'zh_cn' || langCode === 'zh-cn') return 'zh-CN';
      if (langCode === 'zh_hk' || langCode === 'zh-hk') return 'zh-TW'; // 香港使用繁體

      // 前綴匹配
      if (langCode.startsWith('en')) return 'en';
      if (langCode.startsWith('ja')) return 'ja';
      if (langCode.startsWith('ko')) return 'ko';
      if (langCode.startsWith('fr')) return 'fr';
      if (langCode.startsWith('de')) return 'de';
      if (langCode.startsWith('es')) return 'es';
      if (langCode.startsWith('zh')) return 'zh-TW'; // 預設中文使用繁體
    }

    // 預設語言
    console.log('[FB Filter] 無法偵測語言，使用預設語言 (English)');
    return 'en';
  }

  // 取得當前語言的關鍵字
  let currentLanguage = null;
  let currentKeywords = null;

  function getFilterKeywords() {
    const detectedLang = detectFacebookLanguage();

    // 只在語言改變時更新
    if (detectedLang !== currentLanguage) {
      currentLanguage = detectedLang;
      currentKeywords = KEYWORDS_BY_LANGUAGE[detectedLang] || KEYWORDS_BY_LANGUAGE['en'];
      console.log(`[FB Filter] 使用語言: ${detectedLang}`, currentKeywords);
    }

    return currentKeywords;
  }

  /**
   * 標準化文字內容，避免空白與換行造成比對失敗
   */
  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  const HIGH_CONFIDENCE_AD_SELECTOR = [
    '[attributionsrc*="/privacy_sandbox/comet/register/source/"]',
    '[data-ad-rendering-role^="cta"]',
    'img[src*="/t45.1600-"]'
  ].join(', ');

  const REEL_LINK_SELECTOR = [
    'a[href^="/reel/"]',
    'a[href*="facebook.com/reel/"]'
  ].join(', ');

  function isExactKeywordLabel(text, labels) {
    const normalized = normalizeText(text).toLocaleLowerCase();
    if (!normalized) {
      return false;
    }

    return (labels || []).some(keyword =>
      normalizeText(keyword).toLocaleLowerCase() === normalized
    );
  }

  function isReelLabel(text, keywords) {
    return isExactKeywordLabel(text, keywords.reels);
  }

  function isReelRegion(element, keywords) {
    if (!element || element.getAttribute('role') !== 'region') {
      return false;
    }

    if (isReelLabel(element.getAttribute('aria-label'), keywords)) {
      return true;
    }

    // Facebook 會不定期拿掉標題，但 Reel 輪播仍會包含多個 /reel/ 連結。
    return element.querySelectorAll(REEL_LINK_SELECTOR).length >= 2;
  }

  function isPeopleSuggestionRegion(element, keywords) {
    return Boolean(
      element &&
      element.getAttribute('role') === 'region' &&
      isExactKeywordLabel(
        element.getAttribute('aria-label'),
        keywords.peopleSuggestions
      )
    );
  }

  function isEmptySectionSibling(element) {
    if (!element || normalizeText(element.textContent)) {
      return false;
    }

    return !element.querySelector(
      'a, button, img, video, [role="button"], [role="region"]'
    );
  }

  /**
   * 橫向推薦區塊外層另包一層 section shell，旁邊只有空白分隔線。
   * 一併移除 shell，避免留下卡片間距或只移除輪播內層。
   */
  function promoteSectionShell(sectionContent, mainContent) {
    const card = sectionContent && sectionContent.parentElement
      ? sectionContent.parentElement
      : sectionContent;
    const shell = card ? card.parentElement : null;

    if (!card || !shell || shell === mainContent || shell.children.length > 3) {
      return card;
    }

    const meaningfulChildren = Array.from(shell.children).filter(
      child => !isEmptySectionSibling(child)
    );

    return meaningfulChildren.length === 1 && meaningfulChildren[0] === card
      ? shell
      : card;
  }

  function findLabeledSectionContainer(region, mainContent, isMatchingLabel) {
    const feedUnit = findFeedUnitContainer(region, mainContent);
    if (feedUnit) {
      return feedUnit;
    }

    let current = region.parentElement;
    let depth = 0;

    while (current && current !== mainContent && depth < 12) {
      const hasMatchingHeading = Array.from(
        current.querySelectorAll('h1, h2, h3, h4, [role="heading"]')
      ).some(heading => isMatchingLabel(heading.textContent));

      if (hasMatchingHeading) {
        return promoteSectionShell(current, mainContent);
      }

      current = current.parentElement;
      depth++;
    }

    return findBestPostContainer(region, {
      mainContent,
      maxDepth: 25,
      maxHeight: 3000,
      minimumScore: 0,
      allowUnscoredFallback: true
    });
  }

  function findReelContainer(region, mainContent, keywords) {
    return findLabeledSectionContainer(
      region,
      mainContent,
      text => isReelLabel(text, keywords)
    );
  }

  function findPeopleSuggestionContainer(region, mainContent, keywords) {
    return findLabeledSectionContainer(
      region,
      mainContent,
      text => isExactKeywordLabel(text, keywords.peopleSuggestions)
    );
  }

  /**
   * 解析 aria-labelledby 指向的隱藏文字
   * Facebook 目前會把「贊助」放在隱藏節點，再由可見元素引用
   */
  function resolveAriaLabelledbyText(element) {
    if (!element || !element.getAttribute) {
      return '';
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (!labelledBy) {
      return '';
    }

    return labelledBy
      .split(/\s+/)
      .map(id => {
        const target = document.getElementById(id);
        return normalizeText(target ? target.textContent : '');
      })
      .filter(Boolean)
      .join(' ');
  }

  /**
   * 收集用於偵測的文字來源
   * 每個 aria-labelledby 節點會由外層 selector 個別掃描，避免重複遍歷後代
   */
  function collectDetectionTexts(element) {
    if (!element) {
      return [];
    }

    const texts = new Set();
    const addText = (value) => {
      const normalized = normalizeText(value);
      if (normalized) {
        texts.add(normalized);
      }
    };

    addText(element.textContent);
    addText(element.getAttribute ? element.getAttribute('aria-label') || '' : '');
    addText(resolveAriaLabelledbyText(element));

    return Array.from(texts);
  }

  /**
   * 找到 Facebook feed 中對應的完整內容單元。
   * 這些結構訊號比尺寸與內容評分更早出現，也不會只選到廣告內層卡片。
   */
  function findFeedUnitContainer(startElement, mainContent = null) {
    const element = startElement && startElement.nodeType === 1
      ? startElement
      : startElement && startElement.parentElement;

    if (!element) {
      return null;
    }

    const main = mainContent || element.closest('[role="main"]');
    if (!main || !main.contains(element)) {
      return null;
    }

    const feed = element.closest('[role="feed"]');
    if (feed && main.contains(feed)) {
      let unit = element;

      while (unit.parentElement && unit.parentElement !== feed) {
        unit = unit.parentElement;
      }

      if (unit.parentElement === feed) {
        return unit;
      }
    }

    const pagelet = element.closest('[data-pagelet^="FeedUnit_"]');
    if (pagelet && main.contains(pagelet)) {
      return pagelet;
    }

    const article = element.closest('[role="article"]');
    if (article && main.contains(article)) {
      return article;
    }

    return null;
  }

  /**
   * 評估祖先是否像是一整篇貼文容器
   * 用於避免只移除廣告內部卡片，而保留貼文標頭/互動列
   */
  function getPostContainerScore(element) {
    if (!element || !element.querySelector) {
      return 0;
    }

    const roleWeights = {
      profile_name: 4,
      story_message: 3,
      meta: 2,
      image: 2,
      like_button: 2,
      comment_button: 1,
      share_button: 1
    };
    const seenRoles = new Set();
    let score = 0;

    element.querySelectorAll('[data-ad-rendering-role], [role="toolbar"]').forEach(node => {
      const adRole = node.getAttribute('data-ad-rendering-role');

      if (adRole && roleWeights[adRole] && !seenRoles.has(adRole)) {
        seenRoles.add(adRole);
        score += roleWeights[adRole];
      }

      if (node.getAttribute('role') === 'toolbar' && !seenRoles.has('toolbar')) {
        seenRoles.add('toolbar');
        score += 1;
      }
    });

    return score;
  }

  /**
   * 從錨點向上尋找最適合移除的整篇貼文容器
   * 不採用第一個符合尺寸的祖先，而是挑選訊號最完整的候選節點
   */
  function findBestPostContainer(startElement, options = {}) {
    if (!startElement) {
      return null;
    }

    const {
      maxDepth = 25,
      minHeight = 200,
      maxHeight = 1800,
      minWidth = 300,
      maxWidth = 700,
      minimumScore = 1,
      allowUnscoredFallback = true,
      mainContent = null
    } = options;

    const feedUnit = findFeedUnitContainer(startElement, mainContent);
    if (feedUnit) {
      return feedUnit;
    }

    let current = startElement;
    let depth = 0;
    let firstValidCandidate = null;
    let bestCandidate = null;

    while (current && current.parentElement && depth < maxDepth) {
      if (current.getAttribute && current.getAttribute('role') === 'main') {
        break;
      }

      const rect = current.getBoundingClientRect();
      const height = rect.height;
      const width = rect.width;

      if (height > minHeight && height < maxHeight && width > minWidth && width < maxWidth) {
        const candidate = {
          element: current,
          depth,
          score: getPostContainerScore(current)
        };

        if (!firstValidCandidate) {
          firstValidCandidate = candidate;
        }

        if (
          !bestCandidate ||
          candidate.score > bestCandidate.score ||
          (candidate.score === bestCandidate.score && candidate.score > 0 && candidate.depth < bestCandidate.depth)
        ) {
          bestCandidate = candidate;
        }
      }

      current = current.parentElement;
      depth++;
    }

    if (bestCandidate && bestCandidate.score >= minimumScore) {
      return bestCandidate.element;
    }

    return allowUnscoredFallback && firstValidCandidate ? firstValidCandidate.element : null;
  }

  /**
   * 將 MutationObserver 提供的節點整理成最少的局部掃描根節點
   */
  function normalizeScanRoots(mainContent, requestedRoots, options = {}) {
    if (!requestedRoots) {
      return [mainContent];
    }

    const {
      promoteToFeedUnit = true,
      fallbackToMain = true
    } = options;
    const candidates = [];

    Array.from(requestedRoots).forEach(root => {
      let element = root && root.nodeType === 1
        ? root
        : root && root.parentElement;

      if (!element || !element.isConnected) {
        return;
      }

      if (
        element.matches('.fb-filter-removed, .fb-filter-pending') ||
        element.closest('.fb-filter-removed, .fb-filter-pending')
      ) {
        return;
      }

      if (element.contains(mainContent)) {
        element = mainContent;
      } else if (!mainContent.contains(element)) {
        return;
      }

      candidates.push(
        promoteToFeedUnit
          ? findFeedUnitContainer(element, mainContent) || element
          : element
      );
    });

    const compactRoots = [];

    candidates.forEach(candidate => {
      if (compactRoots.some(root => root.contains(candidate))) {
        return;
      }

      for (let index = compactRoots.length - 1; index >= 0; index--) {
        if (candidate.contains(compactRoots[index])) {
          compactRoots.splice(index, 1);
        }
      }

      compactRoots.push(candidate);
    });

    // 先將同一貼文的 mutations 合併成一個 feed unit，避免動輒增加
    // 幾十個孫節點時被誤升級成掃描整個首頁。
    if (fallbackToMain && compactRoots.length > 40) {
      return [mainContent];
    }

    return compactRoots;
  }

  /**
   * 在局部根節點中搜尋，並包含根節點本身與符合條件的最近祖先。
   */
  function collectMatchingElements(mainContent, scanRoots, selector) {
    const matches = new Set();

    scanRoots.forEach(root => {
      if (root.matches(selector)) {
        matches.add(root);
      }

      const closestMatch = root.closest(selector);
      if (closestMatch && mainContent.contains(closestMatch)) {
        matches.add(closestMatch);
      }

      root.querySelectorAll(selector).forEach(element => matches.add(element));
    });

    return Array.from(matches);
  }


  // 批次處理佇列
  let pendingRemovals = [];
  let isProcessingBatch = false;
  const removedContentByPlaceholder = new WeakMap();

  function restorePendingStyles(item, releaseContainer = false) {
    if (!item || !item.element) {
      return;
    }

    item.element.classList.remove('fb-filter-pending');
    item.element.style.visibility = item.previousVisibility;
    item.element.style.pointerEvents = item.previousPointerEvents;

    if (releaseContainer) {
      removedContainers.delete(item.element);
    }
  }

  function restoreRemovedContent() {
    pendingRemovals.forEach(item => restorePendingStyles(item, true));
    pendingRemovals = [];

    document.querySelectorAll('.fb-filter-pending').forEach(element => {
      element.classList.remove('fb-filter-pending');
      element.style.visibility = '';
      element.style.pointerEvents = '';
      removedContainers.delete(element);
    });

    document.querySelectorAll('.fb-filter-removed').forEach(placeholder => {
      const originalContent = removedContentByPlaceholder.get(placeholder);

      if (!originalContent || !placeholder.parentElement) {
        return;
      }

      removedContainers.delete(originalContent);

      try {
        placeholder.parentElement.replaceChild(originalContent, placeholder);
      } catch (error) {
        // Facebook 可能已在路由切換時移除 placeholder。
      }
    });

    processedElements = new WeakSet();
    removedContainers = new WeakSet();
  }

  /**
   * 偵測成功時立即隱藏，DOM 替換則留到下一個 animation frame。
   */
  function queueRemoval(element, keyword, category) {
    if (
      !filteringActive ||
      !element ||
      !element.parentElement ||
      removedContainers.has(element) ||
      element.matches('.fb-filter-removed') ||
      element.closest('.fb-filter-removed')
    ) {
      return false;
    }

    const pendingAncestor = element.closest('.fb-filter-pending');
    if (pendingAncestor && pendingAncestor !== element) {
      return false;
    }

    const previousVisibility = element.style.visibility;
    const previousPointerEvents = element.style.pointerEvents;

    removedContainers.add(element);
    element.classList.add('fb-filter-pending');
    element.style.visibility = 'hidden';
    element.style.pointerEvents = 'none';

    pendingRemovals.push({
      element,
      keyword,
      category,
      previousVisibility,
      previousPointerEvents
    });
    processBatchRemovals();
    return true;
  }

  /**
   * 批次移除元素，避免 DOM thrashing
   */
  function processBatchRemovals() {
    if (isProcessingBatch || pendingRemovals.length === 0) {
      return;
    }

    isProcessingBatch = true;

    const batch = pendingRemovals.splice(0, 20);

    // 使用 requestAnimationFrame 確保在適當時機執行
    requestAnimationFrame(() => {
      const keywords = filteringActive ? getFilterKeywords() : null;

      batch.forEach(item => {
        if (!filteringActive || !item.element || !item.element.parentElement) {
          restorePendingStyles(item, true);
          return;
        }

        // 創建 placeholder 並顯示提示文字
        const placeholder = document.createElement('div');
        placeholder.className = 'fb-filter-removed';

        const removedText = (keywords.removedText && keywords.removedText[item.category]) ||
                           `Removed ${item.category}`;
        placeholder.textContent = removedText;
        placeholder.style.cssText = `
          color: #8a8d91;
          font-size: 14px;
          padding: 8px;
          text-align: center;
          font-family: system-ui, -apple-system, sans-serif;
        `;

        restorePendingStyles(item);

        try {
          removedContentByPlaceholder.set(placeholder, item.element);
          item.element.parentElement.replaceChild(placeholder, item.element);
          removedCount++;
          console.log(`[FB Filter] 已移除 ${item.category} #${removedCount}: ${item.keyword}`);
        } catch (e) {
          removedContainers.delete(item.element);
          // 元素可能已被移除，忽略錯誤
        }
      });

      isProcessingBatch = false;

      if (filteringActive && pendingRemovals.length > 0) {
        processBatchRemovals();
      }
    });
  }

  /**
   * MutationObserver 的同一個 microtask 內處理高可信度訊號，
   * 讓廣告與 Reel 在瀏覽器下一次繪製前就被隱藏。
   */
  function runImmediateFilters(requestedRoots) {
    if (!filteringActive) {
      return;
    }

    const mainContent = document.querySelector('[role="main"]');
    if (!mainContent || !requestedRoots || requestedRoots.length === 0) {
      return;
    }

    const scanRoots = normalizeScanRoots(mainContent, requestedRoots, {
      promoteToFeedUnit: false,
      fallbackToMain: false
    });
    if (scanRoots.length === 0) {
      return;
    }

    const keywords = getFilterKeywords();
    const containerOptions = {
      mainContent,
      maxDepth: 30,
      minimumScore: 1,
      allowUnscoredFallback: false
    };

    const adMarkers = collectMatchingElements(
      mainContent,
      scanRoots,
      HIGH_CONFIDENCE_AD_SELECTOR
    );

    adMarkers.forEach(marker => {
      const container = findBestPostContainer(marker, containerOptions);
      if (container) {
        queueRemoval(container, 'early ad marker', 'sponsored');
      }
    });

    const sectionRegions = collectMatchingElements(
      mainContent,
      scanRoots,
      '[role="region"]'
    );

    sectionRegions.forEach(region => {
      if (isPeopleSuggestionRegion(region, keywords)) {
        const container = findPeopleSuggestionContainer(
          region,
          mainContent,
          keywords
        );

        if (container) {
          queueRemoval(
            container,
            normalizeText(region.getAttribute('aria-label')),
            'button'
          );
        }
        return;
      }

      if (!isReelRegion(region, keywords)) {
        return;
      }

      const container = findReelContainer(region, mainContent, keywords);

      if (container) {
        queueRemoval(container, normalizeText(region.getAttribute('aria-label')) || 'Reel region', 'reels');
      }
    });
  }

  /**
   * 檢查並收集推薦內容（優化版本 v1.0.2）
   * 批次收集，統一處理，避免效能問題
   */
  function removeRecommendations(requestedRoots = null) {
    if (!filteringActive) {
      return;
    }

    // 先找到主要內容區域
    const mainContent = document.querySelector('[role="main"]');

    if (!mainContent) {
      if (DEBUG) console.log('[FB Filter] 找不到主要內容區域 (role="main")');
      return;
    }

    const scanRoots = normalizeScanRoots(mainContent, requestedRoots);
    if (scanRoots.length === 0) {
      return;
    }

    const sponsoredContainerOptions = requestedRoots
      ? { mainContent, maxDepth: 25, minimumScore: 4, allowUnscoredFallback: false }
      : { mainContent, maxDepth: 25 };

    let debugCount = { found: 0, collected: 0, skipped: 0 };
    const keywords = getFilterKeywords();

    // 新增：優先檢查 .html-div > span 中的「為你推薦」標記
    const htmlDivElements = collectMatchingElements(mainContent, scanRoots, '.html-div > span');

    if (DEBUG) console.log(`[FB Filter] 找到 ${htmlDivElements.length} 個 .html-div > span 元素`);

    htmlDivElements.forEach(span => {
      if (processedElements.has(span)) {
        return;
      }

      const text = (span.textContent || '').trim();

      // 使用現有的語言配置來檢查推薦標記
      let isRecommended = false;
      let matchedKeyword = null;

      // 使用完全匹配而非包含，避免誤判正常貼文
      const suggestedMarkers = keywords.suggested || [];
      for (const keyword of suggestedMarkers) {
        if (text === keyword) {
          isRecommended = true;
          matchedKeyword = keyword;
          break;
        }
      }

      if (isRecommended) {
        debugCount.found++;
        if (DEBUG) console.log(`[FB Filter] 發現推薦標記: 完全匹配 "${matchedKeyword}" in .html-div > span`);

        const container = findBestPostContainer(span, {
          mainContent,
          maxDepth: 20,
          maxHeight: 3000,
          minimumScore: 0,
          allowUnscoredFallback: true
        });

        if (container) {
          processedElements.add(span);

          if (queueRemoval(container, matchedKeyword, 'button')) {
            debugCount.collected++;
          }
        }
      }
    });

    // Facebook 的橫向推薦區塊需要從 region 提升到完整 section shell。
    const sectionRegions = collectMatchingElements(mainContent, scanRoots, '[role="region"]');

    sectionRegions.forEach(region => {
      if (processedElements.has(region)) {
        return;
      }

      let container = null;
      let category = null;
      let marker = normalizeText(region.getAttribute('aria-label'));

      if (isPeopleSuggestionRegion(region, keywords)) {
        container = findPeopleSuggestionContainer(region, mainContent, keywords);
        category = 'button';
      } else if (isReelRegion(region, keywords)) {
        container = findReelContainer(region, mainContent, keywords);
        category = 'reels';
        marker = marker || 'Reel region';
      }

      if (container && category) {
        processedElements.add(region);

        if (queueRemoval(container, marker, category)) {
          debugCount.found++;
          debugCount.collected++;
        }
      }
    });

    // 廣告 attribution 與 t45.1600 素材在貼文標頭建立時就會出現，
    // 比「贊助」字樣或 CTA 渲染完成更早。
    const earlyAdMarkers = collectMatchingElements(
      mainContent,
      scanRoots,
      HIGH_CONFIDENCE_AD_SELECTOR
    );

    earlyAdMarkers.forEach(marker => {
      if (processedElements.has(marker)) {
        return;
      }

      const container = findBestPostContainer(marker, sponsoredContainerOptions);
      if (container) {
        processedElements.add(marker);
        debugCount.found++;

        if (queueRemoval(container, 'early ad marker', 'sponsored')) {
          debugCount.collected++;
        }
      }
    });

    // 優化策略：只搜尋可能包含推薦內容的按鈕
    const buttonElements = collectMatchingElements(mainContent, scanRoots, '[role="button"]');

    if (DEBUG) console.log(`[FB Filter] 找到 ${buttonElements.length} 個按鈕`);

    // 先用文字快速排除無關按鈕，只有命中後才讀取祖先尺寸。
    const buttonInfos = Array.from(buttonElements).map(button => {
      if (processedElements.has(button)) {
        return null;
      }

      const buttonText = normalizeText(button.textContent);
      if (buttonText.length > 100) {
        return null;
      }

      return {
        button,
        text: buttonText
      };
    }).filter(Boolean);

    // 處理每個按鈕（只做檢查，不做 DOM 操作）
    buttonInfos.forEach(info => {
      const { button, text } = info;

      // 檢查是否包含目標關鍵字
      let isTargetButton = false;
      let matchedKeyword = null;

      // 新版廣告會直接顯示「贊助 · 出資者」，不一定提供 aria-label。
      for (const keyword of (keywords.sponsored || [])) {
        if (text === keyword || text.startsWith(`${keyword} `) || text.startsWith(`${keyword}·`)) {
          isTargetButton = true;
          matchedKeyword = { keyword, category: 'sponsored' };
          break;
        }
      }

      // 檢查「追蹤」、「加入」按鈕
      if (!isTargetButton) {
        for (const keyword of [...(keywords.follow || []), ...(keywords.join || [])]) {
          if (text.includes(keyword)) {
            // 確認不是「追蹤中」、「已加入」等
            let isExcluded = false;
            for (const exclude of (keywords.exclude || [])) {
              if (text.includes(exclude)) {
                isExcluded = true;
                break;
              }
            }

            if (!isExcluded) {
              isTargetButton = true;
              matchedKeyword = { keyword, category: 'button' };
              break;
            }
          }
        }
      }

      // 檢查 Reels 按鈕
      if (!isTargetButton) {
        for (const keyword of (keywords.reels || [])) {
          if (text.includes(keyword)) {
            isTargetButton = true;
            matchedKeyword = { keyword, category: 'reels' };
            break;
          }
        }
      }

      // 如果找到目標按鈕，收集容器資訊
      if (isTargetButton && matchedKeyword) {
        debugCount.found++;

        const container = findBestPostContainer(
          button,
          matchedKeyword.category === 'sponsored'
            ? { ...sponsoredContainerOptions, maxHeight: 3000 }
            : {
                mainContent,
                maxDepth: 20,
                maxHeight: 3000,
                minimumScore: 0,
                allowUnscoredFallback: true
              }
        );

        if (container) {
          processedElements.add(button);

          if (queueRemoval(container, matchedKeyword.keyword, matchedKeyword.category)) {
            debugCount.collected++;
          }
        }
      }
    });

    // 處理贊助內容（也使用批次處理）
    const sponsoredElements = collectMatchingElements(
      mainContent,
      scanRoots,
      'span[aria-label], a[aria-label], [aria-labelledby]'
    );

    sponsoredElements.forEach(element => {
      if (processedElements.has(element)) {
        return;
      }

      const detectionTexts = collectDetectionTexts(element);

      // 檢查贊助關鍵字
      let isSponsored = false;
      let matchedKeyword = null;
      for (const keyword of (keywords.sponsored || [])) {
        if (detectionTexts.some(text => text.includes(keyword))) {
          isSponsored = true;
          matchedKeyword = keyword;
          break;
        }
      }

      if (isSponsored) {
        debugCount.found++;
        const container = findBestPostContainer(element, sponsoredContainerOptions);

        if (container) {
          processedElements.add(element);

          if (queueRemoval(container, matchedKeyword || 'Sponsored', 'sponsored')) {
            debugCount.collected++;
          }
        }
      }
    });

    // 後備規則：部分贊助貼文不再暴露可解析的「贊助」文字
    // 但 CTA 區塊的 data-ad-rendering-role 目前仍是廣告專屬結構
    const sponsoredCtaElements = collectMatchingElements(
      mainContent,
      scanRoots,
      '[data-ad-rendering-role^="cta"]'
    );

    sponsoredCtaElements.forEach(element => {
      if (processedElements.has(element)) {
        return;
      }

      debugCount.found++;
      const container = findBestPostContainer(element, sponsoredContainerOptions);

      if (container) {
        processedElements.add(element);

        if (queueRemoval(container, 'CTA fallback', 'sponsored')) {
          debugCount.collected++;
        }
      }
    });

    if (DEBUG && debugCount.found > 0) {
      console.log(`[FB Filter] 本次掃描統計:`, debugCount);
    }
  }

  const pendingScanRoots = new Set();
  let scanScheduled = false;
  let fullScanPending = false;
  let isProcessing = false;

  function enqueueMicrotask(callback) {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(callback);
      return;
    }

    Promise.resolve().then(callback);
  }

  /**
  * 收集局部掃描根節點。擴充套件自己的 placeholder 不需要再次掃描。
  */
  function enqueueScanRoot(node) {
    if (!filteringActive) {
      return false;
    }

    const element = node && node.nodeType === 1
      ? node
      : node && node.parentElement;

    if (!element || !element.isConnected) {
      return false;
    }

    if (
      element.matches('.fb-filter-removed, .fb-filter-pending') ||
      element.closest('.fb-filter-removed, .fb-filter-pending')
    ) {
      return false;
    }

    pendingScanRoots.add(element);
    return true;
  }

  /**
   * MutationObserver 已經會批次傳入變更，改用 microtask 合併重複掃描。
   * 這會在瀏覽器下一次繪製前執行，不額外等待計時器。
   */
  function scheduleScan({ fullScan = false } = {}) {
    if (!filteringActive) {
      return;
    }

    if (fullScan) {
      fullScanPending = true;
    }

    if (scanScheduled) {
      return;
    }

    scanScheduled = true;
    enqueueMicrotask(flushScheduledScan);
  }

  function flushScheduledScan() {
    scanScheduled = false;

    if (!filteringActive) {
      pendingScanRoots.clear();
      fullScanPending = false;
      return;
    }

    if (isProcessing) {
      scheduleScan();
      return;
    }

    const shouldScanAll = fullScanPending;
    const roots = Array.from(pendingScanRoots);
    fullScanPending = false;
    pendingScanRoots.clear();

    if (!shouldScanAll && roots.length === 0) {
      return;
    }

    isProcessing = true;

    try {
      removeRecommendations(shouldScanAll ? null : roots);
    } finally {
      isProcessing = false;
    }

    if (fullScanPending || pendingScanRoots.size > 0) {
      scheduleScan();
    }
  }

  function isFacebookHomePage() {
    return window.location.pathname === '/';
  }

  function updateDocumentFilterState() {
    const root = document.documentElement;
    if (!root) {
      return;
    }

    root.setAttribute('data-fb-feed-filter-build', BUILD_ID);

    if (filteringActive) {
      root.setAttribute('data-fb-feed-filter-active', 'true');
    } else {
      root.removeAttribute('data-fb-feed-filter-active');
    }
  }

  function stopFiltering() {
    pendingScanRoots.clear();
    fullScanPending = false;
    scanScheduled = false;
    restoreRemovedContent();
  }

  function setFilteringActive(active) {
    const changed = filteringActive !== active;
    filteringActive = active;
    updateDocumentFilterState();

    if (!changed) {
      return;
    }

    if (filteringActive) {
      const detectedLang = detectFacebookLanguage();
      console.log(`[FB Filter] 首頁過濾已啟用，語言: ${detectedLang}`);
      scheduleScan({ fullScan: true });
      return;
    }

    stopFiltering();
    console.log('[FB Filter] 過濾已暫停或目前不在 Facebook 首頁');
  }

  function syncFilteringState() {
    lastKnownUrl = window.location.href;
    setFilteringActive(
      settingsLoaded && extensionEnabled && isFacebookHomePage()
    );
  }

  function applyEnabledSetting(enabled) {
    settingsLoaded = true;
    extensionEnabled = enabled;
    syncFilteringState();
  }

  // 保留低頻完整掃描，作為 Facebook 特殊更新方式的安全網。
  setInterval(() => {
    if (filteringActive) {
      scheduleScan({ fullScan: true });
    }
  }, 10000);

  // Facebook 是 SPA；pushState 不一定觸發 popstate，以短週期檢查作後備。
  setInterval(() => {
    if (window.location.href !== lastKnownUrl) {
      syncFilteringState();
    }
  }, 250);

  window.addEventListener('popstate', syncFilteringState);
  window.addEventListener('hashchange', syncFilteringState);

  // 監聽 DOM 變化（Facebook 動態載入內容）
  const observer = new MutationObserver(mutations => {
    if (window.location.href !== lastKnownUrl) {
      syncFilteringState();
    } else {
      // document_start 執行時 html 可能尚未建立。
      updateDocumentFilterState();
    }

    if (!filteringActive) {
      return;
    }

    let hasQueuedRoot = false;
    const immediateRoots = new Set();

    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' || mutation.type === 'characterData') {
        if (enqueueScanRoot(mutation.target)) {
          hasQueuedRoot = true;
          immediateRoots.add(mutation.target);
        }
        return;
      }

      mutation.addedNodes.forEach(node => {
        const scanNode = node.nodeType === 1 ? node : mutation.target;
        if (enqueueScanRoot(scanNode)) {
          hasQueuedRoot = true;
          immediateRoots.add(scanNode);
        }
      });
    });

    if (hasQueuedRoot) {
      runImmediateFilters(Array.from(immediateRoots));
      scheduleScan();
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'aria-label',
      'aria-labelledby',
      'attributionsrc',
      'data-ad-rendering-role',
      'role',
      'src'
    ]
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName !== 'local' ||
      !Object.prototype.hasOwnProperty.call(changes, FILTER_ENABLED_KEY)
    ) {
      return;
    }

    applyEnabledSetting(changes[FILTER_ENABLED_KEY].newValue !== false);
  });

  browser.storage.local.get({ [FILTER_ENABLED_KEY]: true }).then(settings => {
    applyEnabledSetting(settings[FILTER_ENABLED_KEY] !== false);
  }, error => {
    console.warn('[FB Filter] 無法讀取設定，使用預設啟用狀態', error);
    applyEnabledSetting(true);
  });

})();
