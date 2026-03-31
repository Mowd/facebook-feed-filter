# Facebook Feed Filter

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Firefox Add-on](https://img.shields.io/badge/Firefox-Add--on-orange.svg)](https://addons.mozilla.org/firefox/addon/facebook-feed-filter/)
![Version](https://img.shields.io/badge/version-1.0.4-green.svg)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Mowd/facebook-feed-filter/graphs/commit-activity)

A lightweight Firefox extension that removes sponsored posts, suggested content, and Reels from your Facebook feed, leaving only posts from friends and pages you follow.

## 🌟 Features

- **Remove Sponsored Content**: Automatically detects and hides sponsored posts
- **Filter Suggestions**: Removes suggested posts from pages and people you don't follow
- **Hide Reels**: Filters out Reels and short video content
- **Real-time Filtering**: Uses MutationObserver to catch dynamically loaded content
- **Performance Optimized**: Implements debouncing to minimize impact on browsing speed
- **Privacy Focused**: All processing happens locally, no data collection
- **Multi-language Support**: Currently supports 8 languages

## 🌍 Supported Languages

- English
- 繁體中文 (Traditional Chinese)
- 简体中文 (Simplified Chinese)
- 日本語 (Japanese)
- 한국어 (Korean)
- Français (French)
- Deutsch (German)
- Español (Spanish)

## 📦 Installation

### Option 1: Firefox Add-ons Store (Recommended)
Install directly from Mozilla Add-ons: [Facebook Feed Filter](https://addons.mozilla.org/firefox/addon/facebook-feed-filter/)

### Option 2: Manual Installation (Development)

1. Clone this repository:
```bash
git clone git@github.com:Mowd/facebook-feed-filter.git
cd facebook-feed-filter
```

2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the cloned repository
6. The extension is now active! Visit Facebook to see it in action

### Option 3: Install from Release

1. Download the latest `.xpi` file from the [Releases](https://github.com/Mowd/facebook-feed-filter/releases) page
2. Drag and drop the `.xpi` file into Firefox
3. Click "Add" when prompted
4. Done! The extension is now installed permanently

## 🚀 Usage

1. Once installed, navigate to [Facebook](https://www.facebook.com)
2. The extension runs automatically - no configuration needed
3. Filtered content will be replaced with a subtle placeholder
4. Check the browser console for detailed filtering logs (optional)

## 🛠️ Technical Details

### How It Works

The extension uses content scripts to:
1. Monitor DOM changes using MutationObserver
2. Identify sponsored/suggested content through text matching
3. Find the parent article container and hide it
4. Display a placeholder showing what was filtered

### File Structure

```
facebook-feed-filter/
├── manifest.json         # Extension configuration
├── content.js           # Main content script
├── styles.css          # Styling for placeholders
├── icons/              # Extension icons
├── _locales/           # Internationalization files
├── PRIVACY_POLICY.md   # Privacy policy
└── README.md          # This file
```

### Performance Optimizations

- **Debouncing**: Processes changes in batches every 500ms
- **WeakSet Tracking**: Prevents reprocessing of already filtered elements
- **Selective Scanning**: Only processes new elements added to the DOM

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Issues
- Check existing issues first
- Include browser version and console logs
- Provide steps to reproduce

### Adding Language Support
1. Create a new locale folder in `_locales/`
2. Copy `_locales/en/messages.json` and translate
3. Update detection keywords in `content.js`
4. Submit a pull request

### Development Setup
```bash
# Clone the repository
git clone git@github.com:Mowd/facebook-feed-filter.git
cd facebook-feed-filter

# Make your changes
# Test in Firefox using temporary installation

# Package for distribution
./package.sh
```

### Code Style
- Use clear, descriptive variable names
- Add comments for complex logic
- Test thoroughly before submitting PR

## 📜 Privacy Policy

This extension:
- ✅ Processes all data locally in your browser
- ✅ Does NOT collect or transmit any personal data
- ✅ Does NOT use analytics or tracking
- ✅ Does NOT require any account or sign-in

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for full details.

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🔄 Changelog

### Version 1.0.4
- **Improved Sponsored Post Detection**: Added support for hidden sponsored labels referenced through `aria-labelledby`
- Added CTA-based fallback detection for ad layouts without readable sponsored text
- Improved ancestor container selection so the entire sponsored post is removed instead of only the inner ad card
- Fixed large sponsored image posts leaving the header and engagement bar behind

### Version 1.0.3
- **Updated for Facebook's new recommendation system**: Now detects and filters posts with Facebook's new recommendation markers
- Fixed language-specific recommendation text for Spanish and German
- Improved accuracy to prevent false positives

### Version 1.0.2
- **Major Performance Breakthrough**: Completely resolved lag issues when multiple recommendations appear
- Implemented batch processing for DOM operations - reduces reflows by 95%
- Added progressive hiding mechanism to prevent visual glitches
- Smart MutationObserver management prevents cascade reactions
- Uses requestAnimationFrame for optimal rendering timing
- Increased debounce time to 1000ms for better performance
- Fixed "screen tearing" issue when removing multiple posts simultaneously
- **New Feature**: Shows simple placeholder text where posts were removed
- Placeholder text supports all 8 languages with appropriate translations
- Minimal design - just gray text without borders or backgrounds
- Different messages for recommendations, Reels, and sponsored content

### Version 1.0.1
- **Critical Performance Fix**: Resolved severe performance issues causing page lag
- Fixed: More precise filtering - now only removes posts with "Follow" or "Join" buttons
- Optimized DOM queries - reduced element scanning by 90%
- Changed from scanning all span elements to only button elements
- Enhanced debounce mechanism to prevent duplicate executions
- Increased scan interval from 5s to 10s to reduce CPU usage
- Improved detection logic for Reels and recommendation buttons

### Version 1.0.0
- Initial release
- Support for filtering sponsored posts
- Support for filtering suggested content
- Support for filtering Reels
- Multi-language support (8 languages)
- Visual feedback with counters

## 🙏 Acknowledgments

- Thanks to all contributors and testers
- Inspired by the need for a cleaner Facebook experience
- Built with privacy and performance in mind

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/Mowd/facebook-feed-filter/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Mowd/facebook-feed-filter/discussions)

### ☕ Buy Me a Coffee

If you find this project helpful, consider buying me a coffee!

<a href="https://buymeacoffee.com/mowd" target="_blank"><img src="https://mowd.tw/buymeacoffee.png" alt="Buy Me A Coffee" width="300"></a>

## 🚧 Roadmap

- [ ] Chrome/Edge version
- [ ] Customizable filtering rules
- [ ] Whitelist/blacklist functionality
- [ ] Statistics dashboard
- [ ] Export/import settings
- [ ] More granular content filtering options

## ⚠️ Disclaimer

This extension is not affiliated with, endorsed by, or sponsored by Facebook/Meta. It's an independent tool created to improve user experience.

---

**If you find this extension helpful, please consider:**
- ⭐ Starring this repository
- 🐛 Reporting bugs and suggestions
- 🌍 Contributing translations
- 📢 Sharing with friends who might benefit
