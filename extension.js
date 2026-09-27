import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as KeyboardStatus from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// How long after unlock we keep re-applying the saved layouts.
const SETTLE_MS = 2000;

// Sources are stored as {type, id} rather than object references, because the
// input source manager recreates its source objects whenever it reloads.
const key = source => source ? {type: source.type, id: source.id} : null;

export default class EnglishOnLock extends Extension {
    enable() {
        this._manager = KeyboardStatus.getInputSourceManager();
        this._locked = false;
        this._saved = null;
        this._sessionId = Main.sessionMode.connect('updated', () => this._onSessionUpdated());
        this._onSessionUpdated();
    }

    disable() {
        Main.sessionMode.disconnect(this._sessionId);
        this._stopRestoring();
        this._sessionId = 0;
        this._saved = null;
        this._manager = null;
    }

    _onSessionUpdated() {
        const locked = Main.sessionMode.isLocked;
        if (locked === this._locked)
            return;
        this._locked = locked;

        if (locked) {
            this._stopRestoring();
            this._onLock();
        } else {
            this._onUnlock();
        }
    }

    _onLock() {
        const manager = this._manager;
        this._saved = {
            global: key(manager.currentSource),
            windows: new Map(),
        };
        for (const actor of global.get_window_actors()) {
            const window = actor.meta_window;
            if (window._currentSource)
                this._saved.windows.set(window, key(window._currentSource));
        }

        const primary = manager.inputSources[0];
        if (primary && primary !== manager.currentSource)
            primary.activate(false);
    }

    _onUnlock() {
        const saved = this._saved;
        this._saved = null;
        if (!saved)
            return;

        // After unlock GNOME reloads its input sources (the password entry
        // going away triggers it) and re-activates the most recently used one,
        // which is the layout we forced on lock. That activation gets recorded
        // on the focused window, possibly after we restore. So for a short
        // settle period keep putting the saved layouts back.
        this._restoring = saved;
        this._restoreAll();
        this._manager.connectObject(
            'current-source-changed', () => this._scheduleApply(),
            'sources-changed', () => this._restoreAll(), this);
        global.display.connectObject(
            'notify::focus-window', () => this._scheduleApply(), this);
        this._scheduleApply();

        this._settleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_MS, () => {
            this._settleId = 0;
            this._applyFocused();
            this._stopRestoring();
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopRestoring() {
        this._manager?.disconnectObject(this);
        global.display.disconnectObject(this);
        if (this._idleId)
            GLib.source_remove(this._idleId);
        if (this._settleId)
            GLib.source_remove(this._settleId);
        this._idleId = 0;
        this._settleId = 0;
        this._restoring = null;
    }

    _resolve(k) {
        return k && Object.values(this._manager.inputSources)
            .find(s => s.type === k.type && s.id === k.id);
    }

    _restoreAll() {
        const manager = this._manager;
        if (!this._restoring || !manager._sourcesPerWindow)
            return;
        for (const [window, k] of this._restoring.windows) {
            const source = this._resolve(k);
            if (!source)
                continue;
            window._inputSources = manager.inputSources;
            window._currentSource = source;
        }
    }

    _scheduleApply() {
        if (this._idleId || !this._restoring)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._applyFocused();
            return GLib.SOURCE_REMOVE;
        });
    }

    _applyFocused() {
        const saved = this._restoring;
        if (!saved || Main.sessionMode.isLocked)
            return;

        const manager = this._manager;
        let source;
        if (manager._sourcesPerWindow) {
            const focused = global.display.focus_window;
            if (!focused)
                return;
            const k = saved.windows.get(focused);
            source = k ? this._resolve(k) : null;
        } else {
            source = this._resolve(saved.global);
        }

        if (source && source !== manager.currentSource)
            source.activate(false);
    }
}
