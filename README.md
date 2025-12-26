# YouTube Quick 2x

YouTube の再生速度を **2x に固定（ON/OFF トグル）**できる、超シンプルな Chrome 拡張です。  
操作は **マウスだけで完結**：動画プレイヤー上で **左クリック + 右クリック** で切り替えます。

> 目的：  
> - 速度調整を段階的にいじりたくない  
> - 「2倍速だけ」でいい  
> - できればマウスだけで一発で切り替えたい  
> → そのための最小構成拡張です

---

## Features

- ✅ YouTube の動画上で **左+右 同時押し** → **2x 固定 ON/OFF**
- ✅ YouTube 標準の「**左長押しで2x**」中に **右クリック** → **2x 固定 ON**
- ✅ **Esc** で 2x 固定を解除（OFF）
- ✅ 2x 固定 ON 中は、YouTube 側の速度変更が入っても **2x に戻します**
- ✅ 余計な **右クリックメニュー（context menu）** や誤クリックを抑止

---

## How to Use

YouTube の動画プレイヤー上で：

| 操作 | 動作 |
|------|------|
| **左+右 同時押し** | 2x 固定 **ON / OFF** |
| **左を長押し中** → **右クリック** | 2x 固定 **ON** |
| **Esc** | 2x 固定 **OFF** |

### ポイント
- YouTube標準の「左長押しで一時的に2倍速」機能はそのまま使えます
- 長押し中に「このまま2倍速を維持したい」と思ったら、右クリックするだけでOK
- 同時押しでも発動するので、素早く2倍速にしたい時は両方同時に押せばOK

---

## Install (Developer Mode)

Chrome の「デベロッパーモード」で読み込む方式です。

1. このリポジトリをダウンロード or clone
2. Chrome で `chrome://extensions/` を開く
3. 右上の **デベロッパーモード** を ON
4. **「パッケージ化されていない拡張機能を読み込む」** を押す
5. `Chrome` フォルダ（`manifest.json` がある場所）を選択

---

## Files

```
Chrome/
├── manifest.json   # Chrome Extension (Manifest V3)
└── content.js      # YouTube ページ上で動くスクリプト
```

---

## Customization

`content.js` 冒頭付近の定数を変えるだけで調整できます。

| 定数 | 説明 | デフォルト |
|------|------|-----------|
| `TARGET_RATE` | 固定したい倍率 | `2` |
| `CHORD_WINDOW_MS` | 同時押し判定の猶予（ms）。`null` にすると制限なし | `250` |
| `SUPPRESS_MS` | トグル直後の contextmenu / クリック誤爆を抑止する時間（ms） | `1200` |

---

## Notes / Limitations

- この拡張は **PC の Chrome（YouTube Web版）** 向けです  
  - スマホの YouTube アプリや、モバイル Chrome では拡張が動かないため非対応
- トラックパッドの「右クリック = 2本指タップ」だと、左押し中に操作しにくい場合があります  
  - その場合は `CHORD_WINDOW_MS` を広げるか、外付けマウスの使用を推奨

---

## Development

変更後は `chrome://extensions/` からこの拡張の **更新（Reload）** を押してください。

---

## License

MIT License