/**
 * Facebook 推薦內容移除器
 * 從 DOM 移除推薦內容
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
      exclude: ['追蹤中', '已加入', '已追蹤']
    },
    'zh-CN': {
      follow: ['追踪', '关注'],
      join: ['加入'],
      suggested: ['推荐', '建议'],
      sponsored: ['赞助'],
      reels: ['Reels', '连续短片'],
      exclude: ['追踪中', '关注中', '已加入', '已关注']
    },
    'en': {
      follow: ['Follow'],
      join: ['Join'],
      suggested: ['Suggested', 'Suggested for you'],
      sponsored: ['Sponsored'],
      reels: ['Reels'],
      exclude: ['Following', 'Followed', 'Joined']
    },
    'ja': {
      follow: ['フォロー', 'フォローする'],
      join: ['参加', '参加する'],
      suggested: ['おすすめ', 'あなたへのおすすめ'],
      sponsored: ['スポンサー', '広告'],
      reels: ['リール', 'Reels'],
      exclude: ['フォロー中', '参加済み', 'フォロー済み']
    },
    'ko': {
      follow: ['팔로우', '팔로우하기'],
      join: ['가입', '가입하기'],
      suggested: ['추천', '회원님을 위한 추천'],
      sponsored: ['스폰서', '광고'],
      reels: ['릴스', 'Reels'],
      exclude: ['팔로잉', '가입함', '팔로우 중']
    },
    'fr': {
      follow: ['Suivre', "S'abonner"],
      join: ['Rejoindre'],
      suggested: ['Suggéré', 'Suggéré pour vous'],
      sponsored: ['Sponsorisé'],
      reels: ['Reels'],
      exclude: ['Abonné', 'Déjà abonné', 'Suivi']
    },
    'de': {
      follow: ['Folgen', 'Abonnieren'],
      join: ['Beitreten'],
      suggested: ['Vorgeschlagen', 'Vorschläge für dich'],
      sponsored: ['Gesponsert'],
      reels: ['Reels'],
      exclude: ['Abonniert', 'Folge ich', 'Beigetreten']
    },
    'es': {
      follow: ['Seguir'],
      join: ['Unirse'],
      suggested: ['Sugerido', 'Sugerencias para ti'],
      sponsored: ['Patrocinado', 'Publicidad'],
      reels: ['Reels'],
      exclude: ['Siguiendo', 'Seguido', 'Unido']
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

  /**
   * 檢查文字是否包含任何過濾關鍵字
   */
  function containsFilterKeyword(text) {
    if (!text) return null;

    // 取得當前語言的關鍵字
    const keywords = getFilterKeywords();

    // 檢查每個類別的關鍵字（排除檢查移到容器層級）
    for (const [category, categoryKeywords] of Object.entries(keywords)) {
      // 跳過 exclude 類別
      if (category === 'exclude') continue;

      if (Array.isArray(categoryKeywords)) {
        for (const keyword of categoryKeywords) {
          if (text.includes(keyword)) {
            return { category, keyword };
          }
        }
      }
    }

    return null;
  }

  /**
   * 檢查並移除推薦內容
   */
  function removeRecommendations() {
    // 先找到主要內容區域
    const mainContent = document.querySelector('div[role="main"]');

    if (!mainContent) {
      console.log('[FB Filter] 找不到主要內容區域 (role="main")');
      return;
    }

    // 只在主要內容區域內尋找關鍵字元素
    const allElements = mainContent.querySelectorAll('span, div, a, h4');
    let debugCount = { found: 0, removed: 0, skipped: 0 };

    if (DEBUG) console.log(`[FB Filter] Scanning ${allElements.length} elements in main content`);

    allElements.forEach(element => {
      // 跳過已處理的元素
      if (processedElements.has(element)) {
        return;
      }

      // 如果元素已經不在 DOM 中，跳過
      if (!element.parentElement) {
        return;
      }

      const text = element.textContent || '';

      // 只處理小元素（避免選到整個頁面）
      if (text.length > 1000) {  // 放寬到 1000
        return;
      }

      // 檢查是否包含任何過濾關鍵字
      const matchedKeyword = containsFilterKeyword(text);

      if (matchedKeyword) {
        debugCount.found++;

        // 標記此元素已處理
        processedElements.add(element);

        // 向上找最多20層（增加深度）
        let current = element;
        let depth = 0;
        let foundContainer = false;

        while (current && current.parentElement && depth < 20) {
          // 確保不要移除主要內容區域本身
          if (current.getAttribute && current.getAttribute('role') === 'main') {
            console.log('[FB Filter Debug] 到達 main 容器，停止向上遍歷');
            break;
          }

          const height = current.offsetHeight;
          const width = current.offsetWidth;

          // 除錯：顯示遍歷過程
          if (depth === 0 && DEBUG) {
            console.log(`[FB Filter Debug] 找到關鍵字: "${matchedKeyword.keyword}" (類別: ${matchedKeyword.category})`, {
              textLength: text.length,
              elementTag: element.tagName
            });
          }

          // 調整容器大小限制：高度 150-1200px，寬度 250-700px
          if (height > 150 && height < 1200 && width > 250 && width < 700) {
            // 額外檢查：確保不是太大的容器
            const containerText = current.textContent || '';
            if (containerText.length > 50 && containerText.length < 8000) {
              // 重要：在容器層級再次檢查排除關鍵字
              const keywords = getFilterKeywords();
              let shouldExclude = false;

              if (keywords.exclude) {
                for (const excludeKeyword of keywords.exclude) {
                  if (containerText.includes(excludeKeyword)) {
                    console.log(`[FB Filter] ✅ 容器包含排除關鍵字 "${excludeKeyword}"，保留此內容`, {
                      matchedKeyword: matchedKeyword.keyword,
                      excludeKeyword: excludeKeyword,
                      preview: containerText.substring(0, 100)
                    });
                    shouldExclude = true;
                    break;
                  }
                }
              }

              // 如果包含排除關鍵字，跳過此容器
              if (shouldExclude) {
                // 標記為已處理，避免重複檢查
                processedElements.add(element);
                foundContainer = true;  // 設定為已找到，避免後續的錯誤訊息
                break;
              }

              if (DEBUG && !shouldExclude) {
                console.log(`[FB Filter] ⚠️ 準備移除容器`, {
                  keyword: matchedKeyword.keyword,
                  category: matchedKeyword.category,
                  containerSize: `${width}x${height}`,
                  textLength: containerText.length,
                  preview: containerText.substring(0, 100)
                });
              }

              // 檢查是否已經處理過此容器
              if (!removedContainers.has(current)) {
                removedContainers.add(current);

                // 建立佔位元素（避免版面跳動）
                const placeholder = document.createElement('div');
                placeholder.style.height = '1px';
                placeholder.style.display = 'none';
                placeholder.className = 'fb-filter-removed';

                // 替換為佔位元素
                if (current.parentElement) {
                  current.parentElement.replaceChild(placeholder, current);
                  removedCount++;
                  debugCount.removed++;
                  console.log(`[FB Filter] 已移除推薦內容 #${removedCount}`, {
                    height,
                    width,
                    depth,
                    keyword: matchedKeyword.keyword,
                    category: matchedKeyword.category,
                    textLength: containerText.length
                  });
                  foundContainer = true;
                  break;
                }
              }
            }
          }

          current = current.parentElement;
          depth++;
        }

        if (!foundContainer && DEBUG) {
          debugCount.skipped++;
          console.log(`[FB Filter Debug] 無法找到合適容器`, {
            keyword: matchedKeyword.keyword,
            category: matchedKeyword.category,
            maxDepthReached: depth,
            textPreview: text.substring(0, 50)
          });
        }
      }
    });

    if (debugCount.found > 0) {
      console.log(`[FB Filter] 本次掃描統計:`, debugCount);
    }
  }

  // 延遲執行，等待頁面載入
  setTimeout(() => {
    removeRecommendations();
  }, 3000);

  // 定期掃描新載入的內容
  setInterval(removeRecommendations, 5000);

  // 監聽 DOM 變化（Facebook 動態載入內容）
  const observer = new MutationObserver(() => {
    // 延遲執行，避免過度觸發
    setTimeout(removeRecommendations, 1000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 顯示狀態與語言資訊
  const detectedLang = detectFacebookLanguage();
  console.log(`[FB Filter] 監聽中... 偵測到語言: ${detectedLang}`);
  console.log('[FB Filter] 將自動移除推薦內容');

})();
