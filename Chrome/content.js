(() => {
    const TARGET_RATE = 2;

    // 「同時押し」の猶予。250ms以内なら同時押し扱い。
    // ここを null にすると「左を押しながら右」みたいな遅い押し方でも発動します。
    const CHORD_WINDOW_MS = 250;

    // 同時押しトグル時に出がちな contextmenu / 余計なクリックを潰す猶予
    const SUPPRESS_MS = 1200;

    // 別の動画に移ったら 2x を解除して元の速度に戻す。
    // ここを false にすると、次の動画にも 2x を引き継ぎます。
    const RESET_ON_VIDEO_CHANGE = true;

    // プレイヤーのコントロールバーに置く 2x ボタンの id
    const BUTTON_ID = "__yt_sticky2x_button";
    const TOOLTIP_ID = "__yt_sticky2x_tooltip";

    const state = {
        stickyOn: false,
        previousRate: 1,

        // 2x を ON にした時の動画ID（別の動画に移ったかの判定用）
        stickyVideoId: null,

        suppressUntil: 0,

        video: null,
        settingRate: false,

        leftDown: false,
        rightDown: false,
        leftDownAt: 0,
        rightDownAt: 0,

        // コード（同時押し）を押しっぱなし中に何度もトグルしないためのフラグ
        chordConsumed: false,

        // トグルON時に「元の速度」として使う値（2xに変化する前を拾いたい）
        rateBeforePress: null,

        // Tracks YouTube hold-to-2x state
        tempBoostActive: false,
        pendingRestore: false,
        globalAttached: false,
        playerObserver: null,
        refreshDebounce: null
    };

    const attachedPlayers = new WeakSet();

    function now() {
        return Date.now();
    }

    function shouldSuppressUIEvents() {
        return now() < state.suppressUntil;
    }

    function armSuppressUIEvents() {
        state.suppressUntil = now() + SUPPRESS_MS;
    }

    function getPlayer() {
        return document.getElementById("movie_player") || document.querySelector("#player") || null;
    }

    function getVideo() {
        return document.querySelector("video.html5-main-video") || document.querySelector("video") || null;
    }

    function toast(text) {
        const id = "__yt_sticky2x_toast";
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement("div");
            el.id = id;
            el.style.position = "fixed";
            el.style.top = "16px";
            el.style.left = "50%";
            el.style.transform = "translateX(-50%)";
            el.style.zIndex = "999999";
            el.style.padding = "8px 12px";
            el.style.borderRadius = "999px";
            el.style.fontSize = "14px";
            el.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
            el.style.background = "rgba(0,0,0,0.75)";
            el.style.color = "white";
            el.style.backdropFilter = "blur(6px)";
            el.style.pointerEvents = "none";
            el.style.opacity = "0";
            el.style.transition = "opacity 120ms ease";
            document.documentElement.appendChild(el);
        }

        el.textContent = text;
        el.style.opacity = "1";
        clearTimeout(el.__hideTimer);
        el.__hideTimer = setTimeout(() => {
            el.style.opacity = "0";
        }, 900);
    }

    function updateButton() {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn) return;
        const on = state.stickyOn;
        const label = btn.firstElementChild;

        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("aria-label", on ? "2倍速を解除" : "2倍速");

        // 表示中のツールチップがあれば文言も追従させる
        const tip = document.getElementById(TOOLTIP_ID);
        if (tip && tip.style.display !== "none") tip.textContent = btn.getAttribute("aria-label");
        if (label) {
            label.style.background = on ? "#fff" : "transparent";
            label.style.color = on ? "#0f0f0f" : "#fff";
        }
    }

    // YouTube 標準のツールチップ（ボタンの上に即時表示される半透明のラベル）に見た目を寄せたもの。
    // 標準のものは YouTube 内部で登録されたボタンにしか出ないので自前で出す。
    function showTooltip(e) {
        const btn = e.currentTarget;
        const player = btn.closest("#movie_player") || getPlayer();
        if (!player) return;

        let tip = document.getElementById(TOOLTIP_ID);
        if (!tip || !player.contains(tip)) {
            if (tip) tip.remove();
            tip = document.createElement("div");
            tip.id = TOOLTIP_ID;
            tip.style.position = "absolute";
            tip.style.zIndex = "1003";
            tip.style.transform = "translate(-50%, -100%)";
            tip.style.padding = "5px 9px";
            tip.style.borderRadius = "8px";
            tip.style.background = "rgba(0,0,0,0.3)";
            tip.style.color = "#eee";
            tip.style.fontSize = "12.98px";
            tip.style.fontWeight = "500";
            tip.style.lineHeight = "15px";
            tip.style.fontFamily = '"YouTube Noto", Roboto, Arial, Helvetica, sans-serif';
            tip.style.textShadow = "0 0 2px #000";
            tip.style.whiteSpace = "nowrap";
            tip.style.pointerEvents = "none";
            player.appendChild(tip);
        }

        const b = btn.getBoundingClientRect();
        const p = player.getBoundingClientRect();
        tip.textContent = btn.getAttribute("aria-label");
        tip.style.left = `${b.left - p.left + b.width / 2}px`;
        tip.style.top = `${b.top - p.top - 22}px`;
        tip.style.display = "block";
    }

    function hideTooltip(e) {
        // クリック後に YouTube がフォーカスを外しても、カーソルが乗っている間は出したままにする
        if (e.type === "blur" && e.currentTarget.matches(":hover")) return;
        const tip = document.getElementById(TOOLTIP_ID);
        if (tip) tip.style.display = "none";
    }

    function onButtonClick(e) {
        // プレイヤー側に伝えない（再生/一時停止や全画面の誤爆を防ぐ）
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "click") toggleSticky();
    }

    function ensureButton(player) {
        if (!player) return;
        const existing = document.getElementById(BUTTON_ID);
        if (existing && player.contains(existing)) return;
        if (existing) existing.remove();

        // 字幕・設定ボタンが並ぶエリア。YouTube側の構造が変わって見つからない時は何もしない
        const container = player.querySelector(".ytp-right-controls-left") || player.querySelector(".ytp-right-controls");
        if (!container) return;

        const btn = document.createElement("button");
        btn.id = BUTTON_ID;
        btn.className = "ytp-button";
        btn.type = "button";
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";

        const label = document.createElement("span");
        label.textContent = "2x";
        label.style.padding = "2px 5px";
        label.style.border = "2px solid #fff";
        label.style.borderRadius = "6px";
        label.style.fontSize = "13px";
        label.style.fontWeight = "700";
        label.style.lineHeight = "1";
        label.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        label.style.pointerEvents = "none";
        btn.appendChild(label);

        btn.addEventListener("click", onButtonClick);
        btn.addEventListener("dblclick", onButtonClick);
        btn.addEventListener("mouseenter", showTooltip);
        btn.addEventListener("mouseleave", hideTooltip);
        btn.addEventListener("focus", showTooltip);
        btn.addEventListener("blur", hideTooltip);

        const anchor = container.querySelector(".ytp-subtitles-button") || container.querySelector(".ytp-settings-button");
        if (anchor) {
            anchor.parentNode.insertBefore(btn, anchor);
        } else {
            container.insertBefore(btn, container.firstChild);
        }

        updateButton();
    }

    function bindVideo(v) {
        if (!v || v.__ytSticky2xBound) return;
        v.__ytSticky2xBound = true;

        v.addEventListener("loadedmetadata", applyStickyIfNeeded, true);
        v.addEventListener("ratechange", onRateChange, true);
    }

    function resetPressState() {
        state.leftDown = false;
        state.rightDown = false;
        state.leftDownAt = 0;
        state.rightDownAt = 0;
        state.chordConsumed = false;
        state.rateBeforePress = null;
        state.tempBoostActive = false;
        state.pendingRestore = false;
    }

    function refreshVideo() {
        const v = getVideo();
        if (v && v !== state.video) {
            state.video = v;
            bindVideo(v);

            // Reset sticky per video change
            if (state.stickyOn) {
                state.stickyOn = false;
                updateButton();
            }
            state.previousRate = v.playbackRate || 1;
            resetPressState();
        } else if (!v) {
            state.video = null;
        }
    }

    function getVideoId() {
        const url = new URL(location.href);
        const id = url.searchParams.get("v");
        if (id) return id;
        const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/);
        return m ? m[1] : null;
    }

    // ON にした動画から別の動画へ移っていたら、2x を解除して元の速度に戻す。
    // 広告は動画IDが変わらないので解除されない。
    function resetIfVideoChanged() {
        if (!RESET_ON_VIDEO_CHANGE || !state.stickyOn) return;

        // ミニプレイヤーなど、URLから動画IDが取れない場面では判断しない
        const id = getVideoId();
        if (id == null) return;
        if (state.stickyVideoId == null) {
            state.stickyVideoId = id;
            return;
        }
        if (id === state.stickyVideoId) return;

        state.stickyOn = false;
        state.pendingRestore = false;
        const v = getVideo();
        if (v) setPlaybackRateSafe(v, state.previousRate || 1);
        updateButton();
    }

    function setPlaybackRateSafe(v, rate) {
        if (!v) return false;
        state.settingRate = true;
        try {
            v.playbackRate = rate;
        } finally {
            state.settingRate = false;
        }
        return Math.abs((v.playbackRate || 0) - rate) < 0.0001;
    }

    function applyStickyIfNeeded() {
        resetIfVideoChanged();
        if (!state.stickyOn) return;
        refreshVideo();
        const v = state.video;
        if (!v) return;

        if (Math.abs((v.playbackRate || 0) - TARGET_RATE) > 0.0001) {
            setPlaybackRateSafe(v, TARGET_RATE);
        }
    }

    function onRateChange() {
        if (state.settingRate) return;

        refreshVideo();
        const v = state.video;
        if (!v) return;

        resetIfVideoChanged();
        if (state.stickyOn) {
            if (Math.abs((v.playbackRate || 0) - TARGET_RATE) > 0.0001) {
                setPlaybackRateSafe(v, TARGET_RATE);
            }
            return;
        }

        if (state.leftDown && !state.rightDown) {
            const currentRate = v.playbackRate || 1;
            if (Math.abs(currentRate - TARGET_RATE) < 0.0001) {
                const base = state.rateBeforePress ?? currentRate;
                if (Math.abs(base - TARGET_RATE) > 0.0001) {
                    state.tempBoostActive = true;
                }
            }
        }
    }

    function isChordPressed() {
        if (!(state.leftDown && state.rightDown)) return false;
        if (CHORD_WINDOW_MS == null) return true;
        return Math.abs(state.leftDownAt - state.rightDownAt) <= CHORD_WINDOW_MS;
    }

    function captureRateBeforePressIfNeeded() {
        if (state.rateBeforePress != null) return;
        refreshVideo();
        if (state.video) state.rateBeforePress = state.video.playbackRate || 1;
    }

    function toggleSticky() {
        refreshVideo();
        const v = state.video;

        if (!v) {
            toast("動画が見つからないので切替できません");
            return false;
        }

        if (!state.stickyOn) {
            // 「元の速度」を記録（押してる間だけ2xに変わった後だと困るので、できるだけ早めに取る）
            const base = state.rateBeforePress ?? (v.playbackRate || 1);

            state.previousRate = base;
            state.stickyOn = true;
            state.stickyVideoId = getVideoId();

            state.pendingRestore = false;
            const ok = setPlaybackRateSafe(v, TARGET_RATE);
            if (!ok) {
                state.stickyOn = false;
                toast("この動画では速度変更できません");
                return false;
            }

            updateButton();
            toast("2x ON（左+右 同時押しでOFF / Escでも解除）");
            return true;
        } else {
            state.stickyOn = false;

            // ボタン押下中はYouTube側と喧嘩しやすいので、両方離れてる時だけ戻す
            if (!state.leftDown && !state.rightDown) {
                state.pendingRestore = false;
                setPlaybackRateSafe(v, state.previousRate || 1);
            } else {
                state.pendingRestore = true;
            }

            updateButton();
            toast("2x OFF");
            return true;
        }
    }

    function onMouseDownCapture(e) {
        if (e.button === 0) {
            state.leftDown = true;
            state.leftDownAt = now();
            captureRateBeforePressIfNeeded();
        } else if (e.button === 2) {
            state.rightDown = true;
            state.rightDownAt = now();
            captureRateBeforePressIfNeeded();
        } else {
            return;
        }

        // 同時押しが成立した瞬間に1回だけトグル
        // 右クリックが押された時に左が既に押されていれば、時間制限なしで発動
        // 左クリックが押された時に右が既に押されていれば、CHORD_WINDOW_MS 以内のみ発動
        if (!state.chordConsumed && state.leftDown && state.rightDown) {
            const rightJustPressed = e.button === 2;
            const withinWindow = CHORD_WINDOW_MS == null ||
                Math.abs(state.leftDownAt - state.rightDownAt) <= CHORD_WINDOW_MS;

            // 右クリック押下時は常に発動、左クリック押下時は時間制限内のみ
            if (rightJustPressed || withinWindow) {
                const ok = toggleSticky();
                if (ok) {
                    state.chordConsumed = true;
                    armSuppressUIEvents(); // contextmenu/余計なクリック防止
                }
            }
        }
    }

    function onMouseUpCapture(e) {
        if (e.button === 0) state.leftDown = false;
        if (e.button === 2) state.rightDown = false;

        // Reset after both buttons released
        if (!state.leftDown && !state.rightDown) {
            const shouldRestoreSticky = !state.stickyOn && state.pendingRestore;
            const restoreRateSticky = state.previousRate;
            const shouldRestoreTemp = !state.stickyOn && state.tempBoostActive;
            const restoreRateTemp = state.rateBeforePress;

            resetPressState();

            if (shouldRestoreSticky) {
                refreshVideo();
                if (state.video) {
                    const currentRate = state.video.playbackRate || 1;
                    if (Math.abs(currentRate - TARGET_RATE) < 0.0001) {
                        setPlaybackRateSafe(state.video, restoreRateSticky || 1);
                    }
                }
                return;
            }

            // Restore only if hold-to-2x was detected
            if (shouldRestoreTemp) {
                refreshVideo();
                if (state.video && restoreRateTemp != null) {
                    const currentRate = state.video.playbackRate || 1;
                    if (Math.abs(currentRate - TARGET_RATE) < 0.0001) {
                        setPlaybackRateSafe(state.video, restoreRateTemp);
                    }
                }
            }
        }
    }

    function onClickCapture(e) {
        if (!shouldSuppressUIEvents()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }

    function onContextMenuCapture(e) {
        if (!shouldSuppressUIEvents()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }

    function onKeyDown(e) {
        if (e.key === "Escape" && state.stickyOn) {
            e.preventDefault();
            refreshVideo();
            const v = state.video;
            state.stickyOn = false;
            if (state.leftDown || state.rightDown) {
                state.pendingRestore = true;
            } else {
                state.pendingRestore = false;
                if (v) setPlaybackRateSafe(v, state.previousRate || 1);
            }
            updateButton();
            toast("2x OFF");
        }
    }

    function attachToPlayer(player) {
        if (!player || attachedPlayers.has(player)) return;
        attachedPlayers.add(player);

        player.addEventListener("mousedown", onMouseDownCapture, { capture: true, passive: true });
        player.addEventListener("mouseup", onMouseUpCapture, { capture: true, passive: true });
        player.addEventListener("click", onClickCapture, { capture: true });
        // 同時押しがダブルクリック扱いになると YouTube が全画面にしてしまう（Macで発生）
        player.addEventListener("dblclick", onClickCapture, { capture: true });
        player.addEventListener("contextmenu", onContextMenuCapture, { capture: true });

        if (state.playerObserver) state.playerObserver.disconnect();
        state.playerObserver = new MutationObserver(() => {
            if (state.refreshDebounce) return;
            state.refreshDebounce = setTimeout(() => {
                state.refreshDebounce = null;
                refreshVideo();
                applyStickyIfNeeded();
                ensureButton(player);
            }, 120);
        });
        state.playerObserver.observe(player, { childList: true, subtree: true });

        refreshVideo();
        applyStickyIfNeeded();
    }

    function ensureAttached() {
        const player = getPlayer();
        if (player) attachToPlayer(player);
        refreshVideo();
        applyStickyIfNeeded();
        ensureButton(player);
    }

    function attachGlobalOnce() {
        if (state.globalAttached) return;
        state.globalAttached = true;

        document.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("yt-navigate-finish", () => setTimeout(ensureAttached, 0), true);
        window.addEventListener("popstate", () => setTimeout(ensureAttached, 0), true);
    }

    attachGlobalOnce();
    ensureAttached();
})();
