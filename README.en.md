# MarkEdit → Typlog

[简体中文](README.md) · [繁體中文](README.zh-Hant.md) · English

Read the current MarkEdit document and its images, upload local images, create or update a Typlog draft, assign authors, and open the dashboard editor. No Textpack or other extension is required. The source document and local images remain unchanged.

The interface supports English, Simplified Chinese, and Traditional Chinese, following the first supported language in macOS language preferences. If none match, English is used. Restart MarkEdit after changing the system language. Menus, settings, draft dialogs, progress, and application error messages are localized; document content, tags, site names, and author names are preserved.

## Installation and setup

1. Copy `dist/markedit-typlog.js` in Finder. In MarkEdit, choose **Extensions → Open Documents Folder**, open or create `scripts`, and paste it there. The destination is `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`. Alternatively, run `Install.command`. If macOS blocks terminal access to the app folder, use Finder.
2. Restart MarkEdit.
3. Choose **Extensions → Typlog → Publishing Settings…**.
4. Sign in to Typlog. On the [tokens](https://typlog.com/account/tokens) page, click **+ New token**, enter a name, and select the **profile** and **site** permission checkboxes. Generate an API Token and paste it into the settings window. Reading the account username requires `profile` permission.
5. Click **Read Account & Sites**. The account username, Site ID, and slug are read automatically. A sole accessible active site is selected automatically; otherwise, choose a site from the list. Site and author settings persist. Token is saved as plain text by default, with optional password encryption. If account or site lookup fails, the interface preserves available saved settings and explains the failure. **Manual Settings** provides a fallback.
6. Authors are read for the selected site. A sole author is selected automatically. Click **Choose Authors…** to select one or more authors. Select **No author** to leave the assignment empty; this explicit choice survives refreshes and restarts. Changing the site reloads its authors.
7. Enable XML-RPC in your Typlog site's **Settings → Integrations**.
8. Choose **Typlog → Send as Draft…**. Shortcut: **Control–Option–Command–Shift–T**.

Before using local images, choose **File → Grant Folder Access** in MarkEdit and authorize the document and image folders. This uses MarkEdit's native folder permission flow; its public API cannot select an authorized folder on your behalf.

An empty author selection makes no author assignment. You can add authors in the dashboard afterward; an empty selection does not remove authors already assigned to an existing draft. Selected author IDs are sent through the REST API as `primary_authors`. Prompts display names and usernames when available. The extension verifies the author selection before uploading or creating a post, and reads the post afterward to verify the assignment.

Settings are stored in `~/Library/Containers/app.cyan.markedit/Data/Documents/typlog-publisher/config.json`. **From v0.3.1, Token storage defaults to plain text.** A notice appears before the first save or use of older plain-text settings. Once confirmed, plain-text storage requires no repeated notice or unlocking. Anyone able to read the file or its backups may obtain your Token. Do not share settings. MarkEdit’s current public API has no Keychain interface.

Password encryption is optional; plain-text storage requires no password. Create a separate local encryption password for this extension, unrelated to your Typlog account login password. Setting or changing it does not change your Typlog login password. Encryption protects the Token from being read directly from the settings file; the Token is still decrypted in application memory during use.

To encrypt, open **Token Storage**, select **Encrypt local Token with a separate password**, and save. Create an local encryption password of at least 12 characters. Passwords and encryption keys are never written to disk. Web Crypto AES-256-GCM uses PBKDF2-SHA-256 (600,000 iterations, a random salt, and a fresh IV on each save). **Every time you quit and reopen MarkEdit, or open a new document window, you must enter the password.** Repeated sends in the same window do not require unlocking.

To switch back to plain text, turn encryption off in Token Storage and save. Enter the current local encryption password. The plain-text notice appears only once; after acknowledgement it does not repeat when switching encryption modes or replacing the Token. If you entered the password when opening settings in that same operation, it is not requested again. Cancellation or an incorrect password leaves the encrypted record unchanged. Upgrading never automatically downgrades existing encrypted storage.

Choose **Replace Token…** to enter a new Token, read the account and sites again, and save. If you forget the password, choose the reset option in the unlock dialog to enter a new Token, or select **Delete Local Token…**. After unlocking, deletion is also available in Token Storage. Deleting local data keeps existing draft associations and does not revoke the Token on Typlog; revocation must be done in the Typlog dashboard.

The Token field is masked, and Tokens are not logged or echoed. The installer restricts directory permissions. Site and account metadata remain plain text. Changing storage mode or deleting local data does not erase previous backups or file-system snapshots. Share the extension script; do not share the whole MarkEdit settings folder.

Settings use a top icon toolbar inspired by MarkEdit Settings: **Automatic / Manual Settings / Token Storage**. The window keeps a consistent width while its height smoothly adapts to the active tab, with a brief content fade. Settings fields align to the left: labels sit above controls, help follows its related field, and account, site and author controls are grouped together. Site slug and Site ID sit side by side as one group. All three tabs share a left alignment. Text uses 14px body and 13px help sizes. **Usage & Privacy** and footer actions stay visible; only the settings body scrolls in smaller windows. Usage covers XML-RPC, folder access and Token storage. Draft confirmation displays individual post details. All dialogs share the same form grid, typography and buttons. Longer English text, narrow windows, dark mode, keyboard navigation, reduced motion, reduced transparency and increased contrast are supported. The menu and dialogs use a monochrome outline redrawn from Typlog's official T glyph.

## Images

Save the document first, then use standard Markdown image references:

```markdown
# Post title

![Caption](images/photo.jpg "Preferred caption")

![Another image](<images/file with spaces.png>)
```

- Local paths resolve relative to the document. Absolute paths, `file://`, `~/`, and reference-style image links are also supported. TextBundle `assets/` paths resolve inside the package. Images saved locally by other extensions can be read.
- JPEG, PNG, GIF, and WebP are supported. Base64 images are uploaded; remote image URLs are preserved.
- Repeated references to the same local file upload once. Image syntax in fenced or inline code is ignored.
- HTML image width and height attributes are preserved as styles. The older Shortcut's dimensions inside image titles are supported, for example `![Alt](images/photo.jpg "Caption\" width=\"320px\" height=\"auto")`.
- Standalone images become centered `<figure>` elements. `<figcaption>` uses `title`, then `alt`; neither present means no caption.
- HTML `<img src="…">` is supported. Local images inside `srcset` cause an error asking you to use a single `src`; local paths are not silently sent to Typlog.
- If an image cannot be read, authorize its folder through **File → Grant Folder Access** and retry.
- Legacy `typlog-media://photo.jpg` references resolve to `photo.jpg` in the document folder without repacking.

Markdown conversion uses bundled markdown-it, so rendering may differ from Apple's rich text converter. Preview tables, captions, dimensions, and special Markdown in the Typlog dashboard. Extra math and Mermaid rendering are not bundled.

## Titles, tags, and HTML

Each send shows editable title and tag fields. Default title priority is: nonempty metadata `title`, then the first real H1, then manual entry. ATX (`# Title`) and Setext H1s are supported; headings inside code are ignored. An opening H1 used as the title is omitted from the body; later H1s remain.

The original Shortcut metadata syntax is supported:

```markdown
:::typlog-shortcut
title: Post title
tag: Writing
tag: Life
format: markdown
:::

Body.
```

A metadata block opening with plain `:::` also works. The block is removed from the submitted body. `format: html` submits HTML content. Repeated `tag:` and `tags:` are supported. **English commas `,` and Chinese commas `，` both separate tags**, including in the draft dialog. Duplicates are removed. An empty `tag:` explicitly requests no tags.

## Sending and recovery

The first dialog shows the title, tags, and **Open the post editor when finished**. The checkbox starts selected and remembers your choice after **Continue**, including when a later request fails. If selected, successful completion opens the dashboard directly; otherwise, a completion alert appears.

The next dialog lists the site, title, tags, local image count, and authors. It explicitly distinguishes **Create Draft** from **Update Existing Draft**. Before confirmation, the extension only reads authors, checks draft status, and reads local images. Uploads and article changes begin after confirmation.

Since v0.1.4, a draft association is keyed by **site slug, Site ID, and the saved document's full path**, with the remote Post ID stored locally. It does not use only the filename, title, or body to determine whether a post already exists. The first send calls `metaWeblog.newPost`; later changes to body, title, tags, or images call `metaWeblog.editPost` on the same post. Both use `post_status=draft` and `publish=false`. Unchanged images reuse uploaded URLs; changed image contents upload again. If local content and author settings are unchanged, the existing draft is reused without overwriting manual dashboard edits.

Draft IDs and image progress are stored in local `document-*.json` records without Tokens. Published, deleted, or unverifiable posts stop the operation instead of creating replacement posts. Failed updates retry the same ID. Failed author assignment retains the saved draft. An uncertain creation result requires checking the dashboard before entering an existing ID or explicitly creating again. If the local record cannot be saved, creation stops.

Older `push-*.json` records migrate when the current content matches. If you edited the body before upgrading, or renamed or moved the document, automatic matching may fail. Expand **Link an Existing Draft** in the first dialog and enter the draft's post ID to reconnect it. Another site has a separate association.

Updating replaces only the extension script and preserves saved account settings and draft records. If an old `Window.fetch` error led to recovery, check whether a draft exists before selecting **No Draft Exists — Create Again**. The Window receiver issue has been fixed.

Do not send the same document from several windows at once. Verify actual account permissions with your own settings and a test document.

## Development and verification

```sh
npm ci --ignore-scripts
npm test
npm run build
```

62 automated tests cover the publishing flow and all three interface languages, translation completeness, placeholders, error classification, and comma-separated tags. They use simulated Typlog responses without reading real Tokens, accessing real accounts, or publishing articles.

References: [MarkEdit API](https://github.com/MarkEdit-app/MarkEdit-api), [MarkEdit customization](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization), [Typlog XML-RPC](https://docs.typlog.com/en/article/marsedit/), [Typlog API](https://api.typlog.com/), [Typlog branding](https://typlog.com/brand).

## License

Project code is licensed under the [MIT License](LICENSE). Bundled dependency licenses are in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). Typlog’s name and brand assets remain subject to their respective rights; MIT does not grant trademark rights.
