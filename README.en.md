<div align="center">

<img src="Chrome/icons/icon128.png" alt="YouTube Quick 2x" width="128" height="128">

# YouTube Quick 2x

**A dead-simple Chrome extension that flips YouTube to 2x speed and back in an instant**

Mouse-only control — toggle with **Left Click + Right Click** on the video player 🖱️

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F5C518?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.4.0-EA4335?style=flat-square)]()

[日本語](README.md) | **English**

</div>

---

> 💡 **Who is this for?**
> - You don't want to fiddle with speed controls step by step
> - **2x is all you need**
> - You want to toggle it with **just your mouse**
>
> → A minimal extension built for exactly that

---

## ✨ Features

| | Description |
|:--:|:--|
| 🖱️ | **Left + Right click** on the video → **2x ON/OFF** |
| ▶️ | During YouTube's native **"hold left to 2x"**, **right click** → **stays at 2x** after you let go |
| 🔘 | **2x button** in the player controls (next to subtitles / settings) → **2x ON/OFF** |
| ⎋ | **Esc** to turn 2x off |
| ⏭️ | Moving to **another video** turns 2x off and restores your previous speed |
| 🔁 | While 2x is ON, any speed changes by YouTube are **overridden back to 2x** |
| 🚫 | Suppresses unwanted **context menus**, accidental clicks and **accidental fullscreen** |

---

## 🎮 How to Use

On the YouTube video player:

```
  🖱️ Left + Right click     →  2x ON / OFF
  ▶️ Hold Left → Right click →  stays at 2x
  🔘 2x button in controls   →  2x ON / OFF
  ⎋  Esc key                →  2x OFF
```

> [!TIP]
> - YouTube's native "hold left click for temporary 2x" still works as usual
> - If you want to **keep** 2x while holding, just **right click** — done
> - You can also press both buttons simultaneously for a quick toggle
> - The **2x button** lights up while 2x is ON, so it also works as an indicator

---

## 📦 Install

> [!NOTE]
> This extension is loaded via Chrome's Developer Mode (not published on the Chrome Web Store).

**1.** Download or clone this repository

```bash
git clone https://github.com/P0KEBAN/youtube-quick-2x.git
```

**2.** Open `chrome://extensions/` in Chrome

**3.** Enable **Developer mode** (toggle in the top-right corner)

**4.** Click **"Load unpacked"**

**5.** Select the `Chrome` folder (where `manifest.json` is located)

> [!IMPORTANT]
> Make sure to select the `Chrome/` folder, not the repository root.

---

## 📂 Files

```
Chrome/
├── manifest.json    # Chrome Extension config (Manifest V3)
├── content.js       # Main script running on YouTube pages
└── icons/
    ├── icon16.png   # Toolbar icon
    ├── icon48.png   # Extensions page icon
    └── icon128.png  # Chrome Web Store / detail page icon
```

---

## ⚙️ Customization

Adjust the constants at the top of `content.js`:

| Constant | Description | Default |
|:--|:--|:--:|
| `TARGET_RATE` | Playback rate to switch to | `2` |
| `CHORD_WINDOW_MS` | Time window for chord detection (ms). Set to `null` for no limit | `250` |
| `RESET_ON_VIDEO_CHANGE` | Turn 2x off when you move to another video. Set to `false` to carry 2x over | `true` |
| `SUPPRESS_MS` | Duration to suppress context menu / accidental clicks after toggle (ms) | `1200` |

---

## ⚠️ Notes / Limitations

> [!WARNING]
> This extension is designed for **Chrome on desktop (YouTube Web)** only.
> It does not work on the YouTube mobile app or mobile Chrome, as extensions are not supported there.

- Trackpad "right click = two-finger tap" can be tricky while holding the left button
  - → Increase `CHORD_WINDOW_MS` or use an **external mouse**

---

## 🛠️ Development

After making changes, click the **Reload** button on your extension card in `chrome://extensions/`.

```
chrome://extensions/ → 🔄 Reload button on the extension card
```

---

## 📄 License

[MIT License](LICENSE) © 2025 pokeban