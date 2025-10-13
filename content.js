/**
 * Facebook Feed Filter v1.0.2
 * 精準移除 Facebook 推薦內容、贊助貼文和 Reels
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

  // Debug mode - 可以設為 true 來查看詳細的過濾決策
const DEBUG = false;  // 暫時開啟偵錯模式來診斷問題
if (DEBUG) console.log('[FB Filter] Facebook Feed Filter started - DEBUG MODE ON');

  // 初始化：偵測語言
  console.log('[FB Filter] 初始化中...');

  // 已處理的元素和容器
  const processedElements = new WeakSet();
  const removedContainers = new WeakSet();
  let removedCount = 0;

  // 按語言組織的關鍵字配置
  const KEYWORDS_BY_LANGUAGE = {
    'zh-TW': {
      follow: ['追蹤'],
      join: ['加入'],
      suggested: ['推薦', '建議'],
      sponsored: ['贊助'],
      reels: ['Reels', '連續短片'],
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
      suggested: ['推荐', '建议'],
      sponsored: ['赞助'],
      reels: ['Reels', '连续短片'],
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
      suggested: ['Suggested', 'Suggested for you'],
      sponsored: ['Sponsored'],
      reels: ['Reels'],
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
      suggested: ['おすすめ', 'あなたへのおすすめ'],
      sponsored: ['スポンサー', '広告'],
      reels: ['リール', 'Reels'],
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
      suggested: ['추천', '회원님을 위한 추천'],
      sponsored: ['스폰서', '광고'],
      reels: ['릴스', 'Reels'],
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
      suggested: ['Suggéré', 'Suggéré pour vous'],
      sponsored: ['Sponsorisé'],
      reels: ['Reels'],
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
      suggested: ['Vorgeschlagen', 'Vorschläge für dich'],
      sponsored: ['Gesponsert'],
      reels: ['Reels'],
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
      suggested: ['Sugerido', 'Sugerencias para ti'],
      sponsored: ['Patrocinado', 'Publicidad'],
      reels: ['Reels'],
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
    const htmlLang = document.documentElement.lang;

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


  // 批次處理佇列
  let pendingRemovals = [];
  let isProcessingBatch = false;
  let observerRef = null; // 儲存 observer 的引用

  /**
   * 批次移除元素，避免 DOM thrashing
   */
  function processBatchRemovals() {
    if (isProcessingBatch || pendingRemovals.length === 0) {
      return;
    }

    isProcessingBatch = true;

    // 暫停 MutationObserver 避免連鎖反應
    if (observerRef) {
      observerRef.disconnect();
    }

    // 使用 requestAnimationFrame 確保在適當時機執行
    requestAnimationFrame(() => {
      const batch = pendingRemovals.splice(0, 10); // 每批最多處理 10 個

      // 先隱藏所有元素（不觸發重排）
      batch.forEach(item => {
        if (item.element && item.element.parentElement) {
          item.element.style.visibility = 'hidden';
          item.element.style.pointerEvents = 'none';
        }
      });

      // 延遲 100ms 後再移除 DOM
      setTimeout(() => {
        const keywords = getFilterKeywords();

        batch.forEach(item => {
          if (item.element && item.element.parentElement) {
            // 創建 placeholder 並顯示提示文字
            const placeholder = document.createElement('div');
            placeholder.className = 'fb-filter-removed';

            // 設定提示文字
            const removedText = keywords.removedText?.[item.category] ||
                               `Removed ${item.category}`;
            placeholder.textContent = removedText;

            // 設定簡單樣式
            placeholder.style.cssText = `
              color: #8a8d91;
              font-size: 14px;
              padding: 8px;
              text-align: center;
              font-family: system-ui, -apple-system, sans-serif;
            `;

            try {
              item.element.parentElement.replaceChild(placeholder, item.element);
              removedCount++;
              console.log(`[FB Filter] 已移除 ${item.category} #${removedCount}: ${item.keyword}`);
            } catch (e) {
              // 元素可能已被移除，忽略錯誤
            }
          }
        });

        // 重新啟用 MutationObserver
        if (observerRef) {
          observerRef.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        isProcessingBatch = false;

        // 如果還有待處理的元素，繼續處理
        if (pendingRemovals.length > 0) {
          setTimeout(processBatchRemovals, 200);
        }
      }, 100);
    });
  }

  /**
   * 檢查並收集推薦內容（優化版本 v1.0.2）
   * 批次收集，統一處理，避免效能問題
   */
  function removeRecommendations() {
    // 先找到主要內容區域
    const mainContent = document.querySelector('div[role="main"]');

    if (!mainContent) {
      console.log('[FB Filter] 找不到主要內容區域 (role="main")');
      return;
    }

    let debugCount = { found: 0, collected: 0, skipped: 0 };
    const keywords = getFilterKeywords();
    const toRemove = []; // 收集要移除的元素

    // 優化策略：只搜尋可能包含推薦內容的按鈕
    const buttonElements = mainContent.querySelectorAll('[role="button"]');

    if (DEBUG) console.log(`[FB Filter] 找到 ${buttonElements.length} 個按鈕`);

    // 批次讀取所有佈局資訊（避免 layout thrashing）
    const buttonInfos = Array.from(buttonElements).map(button => {
      if (processedElements.has(button)) {
        return null;
      }

      const buttonText = button.textContent || '';
      if (buttonText.length > 100) {
        return null;
      }

      // 使用 getBoundingClientRect 一次性獲取所有尺寸
      const rect = button.getBoundingClientRect();
      return {
        button,
        text: buttonText,
        rect
      };
    }).filter(Boolean);

    // 處理每個按鈕（只做檢查，不做 DOM 操作）
    buttonInfos.forEach(info => {
      const { button, text } = info;

      // 檢查是否包含目標關鍵字
      let isTargetButton = false;
      let matchedKeyword = null;

      // 檢查「追蹤」、「加入」按鈕
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
        processedElements.add(button);

        // 向上尋找貼文容器（使用快取的尺寸資訊）
        let current = button;
        let depth = 0;
        const maxDepth = 15;

        while (current && current.parentElement && depth < maxDepth) {
          if (current.getAttribute && current.getAttribute('role') === 'main') {
            break;
          }

          // 使用快取的尺寸或 getBoundingClientRect（避免 offsetHeight/offsetWidth）
          const rect = current.getBoundingClientRect();
          const height = rect.height;
          const width = rect.width;

          if (height > 200 && height < 1200 && width > 300 && width < 700) {
            if (!removedContainers.has(current)) {
              removedContainers.add(current);

              // 收集到待移除列表
              toRemove.push({
                element: current,
                keyword: matchedKeyword.keyword,
                category: matchedKeyword.category
              });
              debugCount.collected++;
              break;
            }
          }

          current = current.parentElement;
          depth++;
        }
      }
    });

    // 處理贊助內容（也使用批次處理）
    const sponsoredElements = mainContent.querySelectorAll('span[aria-label], a[aria-label]');

    sponsoredElements.forEach(element => {
      if (processedElements.has(element)) {
        return;
      }

      const text = element.textContent || '';
      const ariaLabel = element.getAttribute('aria-label') || '';

      // 檢查贊助關鍵字
      let isSponsored = false;
      for (const keyword of (keywords.sponsored || [])) {
        if (text.includes(keyword) || ariaLabel.includes(keyword)) {
          isSponsored = true;
          break;
        }
      }

      if (isSponsored) {
        debugCount.found++;
        processedElements.add(element);

        // 向上尋找容器（使用 getBoundingClientRect）
        let current = element;
        let depth = 0;

        while (current && current.parentElement && depth < 10) {
          const rect = current.getBoundingClientRect();
          const height = rect.height;
          const width = rect.width;

          if (height > 200 && height < 1200 && width > 300 && width < 700) {
            if (!removedContainers.has(current)) {
              removedContainers.add(current);

              // 收集到待移除列表
              toRemove.push({
                element: current,
                keyword: '贊助內容',
                category: 'sponsored'
              });
              debugCount.collected++;
              break;
            }
          }

          current = current.parentElement;
          depth++;
        }
      }
    });

    // 批次處理收集到的元素
    if (toRemove.length > 0) {
      console.log(`[FB Filter] 收集到 ${toRemove.length} 個待移除元素，開始批次處理...`);

      // 添加到待處理佇列
      pendingRemovals.push(...toRemove);

      // 觸發批次處理
      processBatchRemovals();
    }

    if (DEBUG && debugCount.found > 0) {
      console.log(`[FB Filter] 本次掃描統計:`, debugCount);
    }
  }

  // 防抖計時器
  let debounceTimer = null;
  let isProcessing = false;

  /**
   * 防抖執行函數
   * 避免過度頻繁執行造成效能問題
   */
  function debouncedRemoveRecommendations() {
    // 如果正在批次處理中，跳過
    if (isProcessing || isProcessingBatch) {
      return;
    }

    // 清除之前的計時器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 設定新的防抖計時器（增加到 1000ms）
    debounceTimer = setTimeout(() => {
      isProcessing = true;
      removeRecommendations();
      isProcessing = false;
      debounceTimer = null;
    }, 1000); // 1000ms 防抖延遲（從 500ms 增加）
  }

  // 延遲執行，等待頁面載入
  setTimeout(() => {
    removeRecommendations();
  }, 3000);

  // 定期掃描新載入的內容（降低頻率）
  setInterval(() => {
    if (!isProcessing) {
      removeRecommendations();
    }
  }, 10000); // 改為每 10 秒執行一次

  // 監聽 DOM 變化（Facebook 動態載入內容）
  const observer = new MutationObserver(() => {
    // 使用防抖函數，避免過度觸發
    debouncedRemoveRecommendations();
  });

  // 設置全域引用，供批次處理使用
  observerRef = observer;

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 顯示狀態與語言資訊
  const detectedLang = detectFacebookLanguage();
  console.log(`[FB Filter] 監聽中... 偵測到語言: ${detectedLang}`);
  console.log('[FB Filter] 將自動移除推薦內容');

})();
