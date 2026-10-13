<div align="center">

<img src="Chrome/icons/icon128.png" alt="YouTube Quick 2x" width="128" height="128">

# YouTube Quick 2x

**YouTube をパッと 2 倍速に切り替えられる、超シンプルな Chrome 拡張**

マウスだけで完結 — 動画プレイヤー上で **左クリック + 右クリック** で切り替え 🖱️

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F5C518?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.4.0-EA4335?style=flat-square)]()

**日本語** | [English](README.en.md)

</div>

---

> 💡 **こんな人向け**
> - 速度調整を段階的にいじりたくない
> - 「**2倍速だけ**」でいい
> - できれば**マウスだけ**で一発で切り替えたい
>
> → そのための最小構成拡張です

---

## ✨ Features

| 機能 | 説明 |
|:--:|:--|
| 🖱️ | 動画上で **左+右 同時押し** → **2x ON/OFF** |
| ▶️ | YouTube 標準の「**左長押しで2x**」中に **右クリック** → 指を離しても **2x をキープ** |
| 🔘 | プレイヤーのコントロール（字幕・設定の並び）にある **2x ボタン** → **2x ON/OFF** |
| ⎋ | **Esc** で 2x を解除（OFF） |
| ⏭️ | **別の動画に移る**と 2x は解除され、元の速度に戻ります |
| 🔁 | 2x ON 中は、YouTube 側の速度変更が入っても **2x に戻します** |
| 🚫 | 余計な **右クリックメニュー（context menu）** や誤クリック、**意図しない全画面化**を抑止 |

---

## 🎮 How to Use

YouTube の動画プレイヤー上で：

```
  🖱️ 左+右 同時押し   →  2x ON / OFF
  ▶️ 左を長押し中 → 右  →  2x をキープ
  🔘 2x ボタン         →  2x ON / OFF
  ⎋  Esc キー         →  2x OFF
```

> [!TIP]
> - YouTube標準の「左長押しで一時的に2倍速」機能はそのまま使えます
> - 長押し中に「このまま2倍速を維持したい」と思ったら、**右クリックするだけでOK**
> - 同時押しでも発動するので、素早く2倍速にしたい時は**両方同時に押せばOK**
> - **2x ボタン**は 2x ON の間だけ白く点灯するので、今の状態の目印にもなります

---

## 📦 Install

> [!NOTE]
> Chrome の「デベロッパーモード」で読み込む方式です。

**1.** このリポジトリをダウンロード or clone

```bash
git clone https://github.com/P0KEBAN/youtube-quick-2x.git
```

**2.** Chrome で `chrome://extensions/` を開く

**3.** 右上の **デベロッパーモード** を ON にする

**4.** **「パッケージ化されていない拡張機能を読み込む」** をクリック

**5.** `Chrome` フォルダ（`manifest.json` がある場所）を選択

> [!IMPORTANT]
> `Chrome/` フォルダを指定してください（リポジトリのルートではありません）

---

## 📂 Files

```
Chrome/
├── manifest.json    # Chrome Extension 設定 (Manifest V3)
├── content.js       # YouTube ページ上で動くメインスクリプト
└── icons/
    ├── icon16.png   # ツールバー用アイコン
    ├── icon48.png   # 拡張機能ページ用
    └── icon128.png  # Chrome Web Store / 詳細ページ用
```

---

## ⚙️ Customization

`content.js` 冒頭付近の定数を変えるだけで調整できます：

| 定数 | 説明 | デフォルト |
|:--|:--|:--:|
| `TARGET_RATE` | 切り替え先の倍率 | `2` |
| `CHORD_WINDOW_MS` | 同時押し判定の猶予（ms）。`null` で制限なし | `250` |
| `RESET_ON_VIDEO_CHANGE` | 別の動画に移ったら 2x を解除する。`false` で次の動画にも引き継ぐ | `true` |
| `SUPPRESS_MS` | トグル直後の contextmenu / クリック誤爆を抑止する時間（ms） | `1200` |

---

## ⚠️ Notes / Limitations

> [!WARNING]
> この拡張は **PC の Chrome（YouTube Web版）** 向けです。
> スマホの YouTube アプリや、モバイル Chrome では拡張が動かないため非対応です。

- トラックパッドの「右クリック = 2本指タップ」だと、左押し中に操作しにくい場合があります
  - → `CHORD_WINDOW_MS` を広げるか、**外付けマウス**の使用を推奨

---

## 🛠️ Development

変更後は `chrome://extensions/` からこの拡張の **更新（Reload）** ボタンを押してください。

```
chrome://extensions/ → 拡張カードの 🔄 ボタン
```

---

## 📄 License

[MIT License](LICENSE) © 2025 pokeban
