# English on Lock

A GNOME Shell extension that switches the keyboard layout to your first input
source (e.g. English) when the screen locks, and restores each window's own
layout after you unlock.

Built for setups with several layouts (e.g. `us` + `ru`) and
**Settings → Keyboard → Switch input sources individually for each window**
turned on. GNOME's own per-window tracking records the forced lock-screen layout
on whichever window was focused, and re-activates it after unlock when the
password field goes away. This extension snapshots every window's layout on
lock and keeps putting them back for a short settle period after unlock.

If per-window switching is off, it saves and restores the single global layout
instead.

## Install

```bash
git clone https://github.com/DenisFeofanov/english-on-lock.git \
  ~/.local/share/gnome-shell/extensions/english-on-lock@denis
```

Log out and back in (required on Wayland), then:

```bash
gnome-extensions enable english-on-lock@denis
```

Disable other "layout on lock screen" extensions (such as Primary Input on
LockScreen) so they don't fight over the layout.

## Notes

- Tested on GNOME 46 (Ubuntu 24.04, Wayland). `metadata.json` declares 45–48.
- Uses private fields of GNOME Shell's `InputSourceManager`, so a major GNOME
  release may break it.
- For about 2 seconds after unlock, manual layout switches are reverted to the
  saved layout. Adjust `SETTLE_MS` in `extension.js` if needed.

## License

GPL-2.0-or-later
