const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(new URL('../Chrome/content.js', `file://${__filename}`), 'utf8');

// Run the actual content script with a small DOM/event mock. No test-only exports.
class Element {
    constructor(kind = 'surface') {
        this.kind = kind;
        this.listeners = new Map();
        this.style = {};
        this.children = [];
        this.attributes = {};
    }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    emit(type, props = {}) {
        const event = {
            type, target: this, currentTarget: this, detail: 1,
            defaultPrevented: false, stopped: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.stopped = true; },
            stopImmediatePropagation() { this.stopped = true; },
            ...props
        };
        for (const listener of this.listeners.get(type) || []) {
            listener(event);
            if (event.stopped) break;
        }
        return event;
    }
    appendChild(child) { this.children.push(child); return child; }
    insertBefore(child) { this.appendChild(child); }
    get firstElementChild() { return this.children[0]; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    contains(child) { return this === child || this.children.some(el => el.contains(child)); }
    closest(selector) {
        if (this.kind === 'control' && selector.includes('button')) return this;
        if (this.kind === 'input' && selector.includes('input')) return this;
        return null;
    }
    querySelector() { return null; }
}
function video(rate = 1) {
    const el = new Element();
    el.playbackRate = rate;
    return el;
}
function setup({ reset = true, rate = 1, previewFirst = false } = {}) {
    let clock = 1000;
    let currentVideo = video(rate);
    const player = new Element();
    const controls = new Element('control');
    player.appendChild(controls);
    player.querySelector = selector => selector.startsWith('video') ? currentVideo :
        selector.startsWith('.ytp-right-controls') ? controls : null;
    const root = new Element();
    root.appendChild(player);
    const document = new Element();
    document.documentElement = root;
    document.createElement = () => new Element();
    document.getElementById = id => {
        if (id === 'movie_player') return player;
        function find(el) {
            if (el.id === id) return el;
            for (const child of el.children) { const hit = find(child); if (hit) return hit; }
            return null;
        }
        return find(root);
    };
    // Optionally put an unrelated preview first in page-wide query results.
    const preview = video(0.75);
    document.querySelector = selector => selector.startsWith('video') ? (previewFirst ? preview : currentVideo) : null;
    const window = new Element();
    const location = { href: 'https://www.youtube.com/watch?v=first' };
    let timerId = 0;
    const timers = new Map();
    function flush() {
        const pending = [...timers.values()];
        timers.clear();
        pending.forEach(callback => callback());
    }
    const context = {
        document, window, location, URL,
        Date: { now: () => clock },
        chrome: { i18n: { getMessage: key => key } },
        MutationObserver: class { observe() {} disconnect() {} },
        setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
        clearTimeout(id) { timers.delete(id); }
    };
    vm.runInNewContext(reset ? source : source.replace('RESET_ON_VIDEO_CHANGE = true', 'RESET_ON_VIDEO_CHANGE = false'), context);
    const button = document.getElementById('__yt_sticky2x_button');
    return {
        player, window, document, location, button, preview, controls,
        get video() { return currentVideo; },
        get toast() { return document.getElementById('__yt_sticky2x_toast')?.textContent; },
        tick(ms) { clock += ms; },
        down(button, props) { return player.emit('mousedown', { button, ...props }); },
        up(button, outside = false) {
            const event = window.emit('mouseup', { button });
            if (!outside) player.emit('mouseup', { button });
            return event;
        },
        chord() { this.down(0); this.down(2); },
        release() { this.up(0); this.up(2); },
        replaceVideo(rate) { currentVideo = video(rate); this.navigate(); },
        navigate(id) {
            if (id) location.href = `https://www.youtube.com/watch?v=${id}`;
            document.emit('yt-navigate-finish');
            flush();
        }
    };
}
function assertOn(s, on) { assert.equal(s.button.getAttribute('aria-pressed'), String(on)); }

test('left then right toggles once per chord and restores the original rate', () => {
    const s = setup({ rate: 1.5 });
    s.chord();
    assert.equal(s.video.playbackRate, 2);
    s.down(2);
    assertOn(s, true);
    s.release();
    s.chord();
    assertOn(s, false);
    s.release();
    assert.equal(s.video.playbackRate, 1.5);
});
for (const delay of [200, 300]) {
    test(`right then left after ${delay}ms respects the chord window`, () => {
        const s = setup();
        s.down(2); s.tick(delay); s.down(0);
        assertOn(s, delay <= 250);
    });
}
test('YouTube hold-to-2x can become sticky and still restore 1.5x', () => {
    const s = setup({ rate: 1.5 });
    s.down(0); s.tick(1000);
    s.video.playbackRate = 2; s.video.emit('ratechange');
    s.down(2); s.release();
    assertOn(s, true);
    assert.equal(s.video.playbackRate, 2);
    s.button.emit('click');
    assert.equal(s.video.playbackRate, 1.5);
});
test('releasing outside the player does not leave a phantom left press', () => {
    const s = setup();
    s.down(0); s.up(0, true); s.down(2);
    assertOn(s, false);
});
test('window blur clears a held press', () => {
    const s = setup();
    s.down(0); s.window.emit('blur'); s.down(2);
    assertOn(s, false);
});
test('element blur does not clear an actual held press', () => {
    const s = setup();
    s.down(0); s.window.emit('blur', { target: s.button }); s.down(2);
    assertOn(s, true);
});
test('window blur completes a pending sticky OFF restoration', () => {
    const s = setup({ rate: 1.25 });
    s.chord(); s.release(); s.chord();
    s.window.emit('blur');
    assertOn(s, false);
    assert.equal(s.video.playbackRate, 1.25);
});
test('window blur restores temporary hold-to-2x', () => {
    const s = setup({ rate: 1.5 });
    s.down(0); s.video.playbackRate = 2; s.video.emit('ratechange');
    s.window.emit('blur');
    assert.equal(s.video.playbackRate, 1.5);
});
for (const replacementRate of [1, 2]) {
    test(`same video element replacement at ${replacementRate}x preserves sticky and base rate`, () => {
        const s = setup({ rate: 1.5 });
        s.button.emit('click'); s.replaceVideo(replacementRate);
        assertOn(s, true);
        assert.equal(s.video.playbackRate, 2);
        s.button.emit('click');
        assert.equal(s.video.playbackRate, 1.5);
    });
}
for (const replace of [false, true]) {
    test(`new video restores base rate with ${replace ? 'a new' : 'the same'} element`, () => {
        const s = setup({ rate: 1.25 });
        s.button.emit('click');
        if (replace) s.replaceVideo(2);
        s.navigate('second');
        assertOn(s, false);
        assert.equal(s.video.playbackRate, 1.25);
    });
}
test('reset disabled carries sticky across both video and element changes', () => {
    const s = setup({ rate: 1.5, reset: false });
    s.button.emit('click'); s.location.href = 'https://www.youtube.com/watch?v=second';
    s.replaceVideo(1);
    assertOn(s, true);
    assert.equal(s.video.playbackRate, 2);
    s.button.emit('click'); assert.equal(s.video.playbackRate, 1.5);
});
test('a chord suppresses trailing click, double click and contextmenu', () => {
    const s = setup(); s.chord(); s.release();
    for (const type of ['click', 'dblclick', 'contextmenu']) {
        assert.equal(s.player.emit(type).defaultPrevented, true);
    }
});
test('a chord held past 1200ms still suppresses its release click', () => {
    const s = setup(); s.chord(); s.tick(2000); s.release();
    assert.equal(s.player.emit('click').defaultPrevented, true);
});
test('a new independent click passes immediately', () => {
    const s = setup(); s.chord(); s.release(); s.down(0); s.up(0);
    assert.equal(s.player.emit('click').defaultPrevented, false);
});
test('a second click in a double click sequence stays suppressed', () => {
    const s = setup(); s.chord(); s.release(); s.down(0, { detail: 2 }); s.up(0);
    assert.equal(s.player.emit('dblclick', { detail: 2 }).defaultPrevented, true);
});
test('player controls pass even during the suppression interval', () => {
    const s = setup(); s.chord(); s.release();
    assert.equal(s.player.emit('click', { target: s.controls }).defaultPrevented, false);
});
for (const props of [{ isComposing: true }, { keyCode: 229 }, { target: new Element('input') }, { target: { isContentEditable: true } }]) {
    test(`Escape ignores editing/composition ${JSON.stringify(props)}`, () => {
        const s = setup(); s.button.emit('click');
        s.document.emit('keydown', { key: 'Escape', ...props });
        assertOn(s, true);
    });
}
test('Escape turns sticky off and remains available to YouTube', () => {
    const s = setup({ rate: 1.5 }); s.button.emit('click');
    const event = s.document.emit('keydown', { key: 'Escape' });
    assertOn(s, false); assert.equal(s.video.playbackRate, 1.5);
    assert.equal(event.defaultPrevented, false); assert.equal(event.stopped, false);
    assert.equal(s.toast, 'toastOff');
});
test('throwing playbackRate setter reports failure and permits a later retry', () => {
    const s = setup();
    Object.defineProperty(s.video, 'playbackRate', { configurable: true, get: () => 1, set() { throw new Error('unavailable'); } });
    assert.doesNotThrow(() => s.button.emit('click'));
    assertOn(s, false); assert.equal(s.toast, 'toastRateUnavailable');
    Object.defineProperty(s.video, 'playbackRate', { configurable: true, writable: true, value: 1 });
    s.button.emit('click'); assertOn(s, true);
});
test('ignored playbackRate assignment reports failure', () => {
    const s = setup();
    Object.defineProperty(s.video, 'playbackRate', { get: () => 1, set() {} });
    s.button.emit('click'); assertOn(s, false); assert.equal(s.toast, 'toastRateUnavailable');
});
test('video selection stays within the player', () => {
    const s = setup({ previewFirst: true }); s.button.emit('click');
    assert.equal(s.video.playbackRate, 2); assert.equal(s.preview.playbackRate, 0.75);
});

test('sticky reapplies after YouTube changes the playback rate', () => {
    const s = setup(); s.button.emit('click');
    s.video.playbackRate = 1.5; s.video.emit('ratechange');
    assert.equal(s.video.playbackRate, 2); assertOn(s, true);
});
test('a failed sticky reapplication turns the indicator OFF', () => {
    const s = setup(); s.button.emit('click');
    Object.defineProperty(s.video, 'playbackRate', { get: () => 1, set() { throw new Error('unavailable'); } });
    assert.doesNotThrow(() => s.video.emit('ratechange'));
    assertOn(s, false); assert.equal(s.toast, 'toastRateUnavailable');
});
test('a transition with no video waits for a restoration target', () => {
    const s = setup({ rate: 1.5 }); s.button.emit('click');
    const query = s.player.querySelector;
    s.player.querySelector = selector => selector.startsWith('video') ? null : query(selector);
    s.navigate('second');
    s.player.querySelector = query;
    s.replaceVideo(2);
    assertOn(s, false); assert.equal(s.video.playbackRate, 1.5);
});
test('no video reports an unavailable toggle', () => {
    const s = setup();
    s.player.querySelector = () => null;
    s.button.emit('click'); assertOn(s, false); assert.equal(s.toast, 'toastNoVideo');
});
