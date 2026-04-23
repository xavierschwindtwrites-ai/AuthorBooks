# Installing AuthorBooks on macOS

AuthorBooks is not signed with an Apple Developer certificate, so macOS may show a security warning the first time you open it. These steps walk you through that.

---

## Option 1 — Right-click to open (easiest)

1. Open the **AuthorBooks** DMG and drag the app to your **Applications** folder.
2. In **Applications**, **right-click** (or Control-click) `AuthorBooks.app`.
3. Choose **Open** from the menu.
4. A dialog will appear saying "Apple cannot verify…" — click **Open** anyway.

macOS remembers your choice after the first launch, so this step is only needed once.

---

## Option 2 — Remove the quarantine flag (command line)

If right-clicking doesn't work, or you prefer the terminal:

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Run this command (drag the app into the Terminal window to fill in the path):

   ```bash
   xattr -cr /Applications/AuthorBooks.app
   ```

3. Launch AuthorBooks normally.

---

## Why does this happen?

macOS flags apps from unidentified developers through a feature called **Gatekeeper**. AuthorBooks stores all your data locally on your Mac — it never uploads anything. The quarantine warning is a macOS policy, not an indication of any problem with the app itself.

---

## Troubleshooting

**"AuthorBooks is damaged and can't be opened"**
Run `xattr -cr /Applications/AuthorBooks.app` (Option 2 above) and try again.

**"AuthorBooks can't be opened because it is from an unidentified developer"**
Use the right-click → Open method (Option 1 above).

**App opens but shows a blank screen**
Quit and relaunch. If that doesn't help, delete the app and reinstall from the DMG.

---

## Uninstalling

Drag `AuthorBooks.app` from **Applications** to the Trash.

Your data is stored separately in `~/Library/Application Support/AuthorBooks/` — delete that folder too if you want a clean uninstall.
