(() => {
    const TARGET_RATE = 2;

    // 「同時押し」の猶予。250ms以内なら同時押し扱い。
    // ここを null にすると「左を押しながら右」みたいな遅い押し方でも発動します。
    const CHORD_WINDOW_MS = 250;

    // 同時押しトグル時に出がちな contextmenu / 余計なクリックを潰す猶予
    const SUPPRESS_MS = 1200;

    const state = {
        stickyOn: false,
        previousRate: 1,

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
    }

    function refreshVideo() {
        const v = getVideo();
        if (v && v !== state.video) {
            state.video = v;
            bindVideo(v);

            // Reset sticky per video change
            if (state.stickyOn) {
                state.stickyOn = false;
            }
            state.previousRate = v.playbackRate || 1;
            resetPressState();
        } else if (!v) {
            state.video = null;
        }
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

            const ok = setPlaybackRateSafe(v, TARGET_RATE);
            if (!ok) {
                state.stickyOn = false;
                toast("この動画では速度変更できません");
                return false;
            }

            toast("2x 固定 ON（左+右 同時押しでOFF / Escでも解除）");
            return true;
        } else {
            state.stickyOn = false;

            // ボタン押下中はYouTube側と喧嘩しやすいので、両方離れてる時だけ戻す
            if (!state.leftDown && !state.rightDown) {
                setPlaybackRateSafe(v, state.previousRate || 1);
            }

            toast("2x 固定 OFF");
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
        if (!state.chordConsumed && isChordPressed()) {
            const ok = toggleSticky();
            if (ok) {
                state.chordConsumed = true;
                armSuppressUIEvents(); // contextmenu/余計なクリック防止
            }
        }
    }

    function onMouseUpCapture(e) {
        if (e.button === 0) state.leftDown = false;
        if (e.button === 2) state.rightDown = false;

        // Reset after both buttons released
        if (!state.leftDown && !state.rightDown) {
            const shouldRestore = !state.stickyOn && state.tempBoostActive;
            const restoreRate = state.rateBeforePress;

            resetPressState();

            // Restore only if hold-to-2x was detected
            if (shouldRestore) {
                refreshVideo();
                if (state.video && restoreRate != null) {
                    const currentRate = state.video.playbackRate || 1;
                    if (Math.abs(currentRate - TARGET_RATE) < 0.0001) {
                        setPlaybackRateSafe(state.video, restoreRate);
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
            if (v && !state.leftDown && !state.rightDown) setPlaybackRateSafe(v, state.previousRate || 1);
            toast("2x 固定 OFF");
        }
    }

    function attachToPlayer(player) {
        if (!player || attachedPlayers.has(player)) return;
        attachedPlayers.add(player);

        player.addEventListener("mousedown", onMouseDownCapture, { capture: true, passive: true });
        player.addEventListener("mouseup", onMouseUpCapture, { capture: true, passive: true });
        player.addEventListener("click", onClickCapture, { capture: true });
        player.addEventListener("contextmenu", onContextMenuCapture, { capture: true });

        if (state.playerObserver) state.playerObserver.disconnect();
        state.playerObserver = new MutationObserver(() => {
            if (state.refreshDebounce) return;
            state.refreshDebounce = setTimeout(() => {
                state.refreshDebounce = null;
                refreshVideo();
                applyStickyIfNeeded();
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
