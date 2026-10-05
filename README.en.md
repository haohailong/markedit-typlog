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
6. Authors are read for the selected site. Initially, only the first author is selected, including sites with a sole author; saved selections are retained. **No author** is a checkbox beside the Authors heading. It suspends assignment and disables the author list; turning it off restores the selection in that window or selects the first author. Authors appear as ordinary checkboxes without a separate background group and support multiple selection. **Refresh Authors** reloads the list.
7. Choose **Typlog → Send as Draft…**. Shortcut: **Control–Option–Command–Shift–T**.

Before using local images, choose **File → Grant Folder Access** in MarkEdit and authorize the document and image folders. This uses MarkEdit's native folder permission flow; its public API cannot select an authorized folder on your behalf.

An empty author selection makes no author assignment. You can add authors in the dashboard afterward; an empty selection does not remove authors already assigned to an existing draft. Selected author IDs are sent through the REST API as `primary_authors`. Prompts display names and usernames when available. The extension verifies the author selection before uploading or creating a post, and reads the post afterward to verify the assignment.

Settings are stored in `~/Library/Containers/app.cyan.markedit/Data/Documents/typlog-publisher/config.json`. **From v0.3.1, Token storage defaults to plain text.** A notice appears before the first save or use of older plain-text settings. Once confirmed, plain-text storage requires no repeated notice or unlocking. Anyone able to read the file or its backups may obtain your Token. Do not share settings. MarkEdit’s current public API has no Keychain interface.

Password encryption is optional; plain-text storage requires no password. Create a separate local encryption password for this extension, unrelated to your Typlog account login password. Setting or changing it does not change your Typlog login password. Encryption protects the Token from being read directly from the settings file; the Token is still decrypted in application memory during use.

To encrypt, select **Encrypt local Token with a separate password** in **Token Storage**. Password and confirmation fields appear directly below it. Enter at least 12 characters and choose **Save Settings**; no separate password creation dialog appears. Passwords and keys are never written to disk. Web Crypto AES-256-GCM uses PBKDF2-SHA-256 (600,000 iterations, a random salt, and a fresh IV). After reopening MarkEdit or opening a new document window, the **first send** requires the local password. Subsequent sends in that window do not require unlocking again.

**Opening and saving other settings require no password.** The encrypted record is retained unchanged. After the first account and site discovery is saved, names, IDs and slugs for all accessible sites are cached locally. Settings initially display the cached list and selected site. Each successful password entry refreshes account and site data and synchronizes changes; a failed lookup retains the cache and current site selection. Author lists are also cached. This ordinary metadata is not encrypted; encryption protects only the Token. Cached sites can be selected while locked. If an author list is not cached for that site, enter IDs manually or refresh after unlocking.

To return to plain text, choose **Switch to Plain Text…**, enter the current local password, then **Save Settings**. Cancelling verification or saving, or entering an incorrect password, leaves the original record unchanged. The plain-text notice appears only once. Upgrading never automatically reduces existing Token protection.

The unlock dialog always explains that forgotten passwords can be handled by replacing the Token in **Typlog Publishing Settings**. That text links directly to the **Token Storage** tab and ends the current send operation. During rollback verification, the link returns to the already open storage tab. There is no replacement button or expandable help in the unlock dialog. Replacement is available in settings, requires confirmation and a new Token, and overwrites the old record only when saved. No old password is needed; the new Token can use a new local password. Cancelling settings retains the old record.

If publishing is no longer needed, **Delete Local Token…** immediately deletes the local record after confirmation, without the old password. Recovery guidance remains visible beside the replacement and deletion actions. Both actions retain site settings and draft associations and do not revoke the old Token on Typlog; revoke it in the Typlog dashboard if needed.

The Token field is masked, and Tokens are not logged or echoed. The installer restricts directory permissions. Site and account metadata remain plain text. Changing storage mode or deleting local data does not erase previous backups or file-system snapshots. Share the extension script; do not share the whole MarkEdit settings folder.

Settings use a top icon toolbar inspired by MarkEdit Settings: **Automatic / Manual Settings / Token Storage**. The title and icon are centered together. Chinese headings use one typeface for Latin and Chinese text. The window sits near the top and keeps its top edge fixed as its height smoothly expands or contracts downward for the active tab, with a brief content fade. The account lookup button stays at the right of its row as the status updates on the left. Settings fields align to the left: labels sit above controls, help follows its related field, and account, site and author controls are grouped together. Site slug and Site ID sit side by side as one group. All three tabs share a left alignment. Text uses 14px body and 13px help sizes. **Usage & Privacy** and footer actions stay visible; only the settings body scrolls in smaller windows. Usage covers XML-RPC, folder access and Token storage. Draft confirmation displays individual post details. All dialogs share the same form grid, typography and buttons. Longer English text, narrow windows, dark mode, keyboard navigation, reduced motion, reduced transparency and increased contrast are supported. The menu and dialogs use a monochrome outline redrawn from Typlog's official T glyph.

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

Draft IDs and image progress are stored in local `document-*.json` records without Tokens. Published or unverifiable posts stop the operation. If the linked post returns HTTP 404 and the account can access the configured site, **Linked Draft Not Found** offers to create a new draft from the current document. Successful creation links the document to the new Post ID, which later sends update; images are uploaded again. Cancelling this prompt or the subsequent creation confirmation keeps the original association without uploading or creating. Permission, network, and server errors are not treated as deletion. An uncertain creation still requires manual recovery rather than automatic duplication. Failed updates retry the same ID. Failed author assignment retains the saved draft. An uncertain creation result requires checking the dashboard before entering an existing ID or explicitly creating again. If the local record cannot be saved, creation stops.

Older `push-*.json` records migrate when the current content matches. If you edited the body before upgrading, or renamed or moved the document, automatic matching may fail. Expand **Link an Existing Draft** in the first dialog and enter the draft's post ID to reconnect it. Another site has a separate association.

Updating replaces only the extension script and preserves saved account settings and draft records. If an old `Window.fetch` error led to recovery, check whether a draft exists before selecting **No Draft Exists — Create Again**. The Window receiver issue has been fixed.

Do not send the same document from several windows at once. Verify actual account permissions with your own settings and a test document.

## Development and verification

```sh
npm ci --ignore-scripts
npm test
npm run build
```

80 automated tests cover the publishing flow and all three interface languages, translation completeness, placeholders, error classification, and comma-separated tags. They use simulated Typlog responses without reading real Tokens, accessing real accounts, or publishing articles.

References: [MarkEdit API](https://github.com/MarkEdit-app/MarkEdit-api), [MarkEdit customization](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization), [Typlog XML-RPC](https://docs.typlog.com/en/article/marsedit/), [Typlog API](https://api.typlog.com/), [Typlog branding](https://typlog.com/brand).

## License

Project code is licensed under the [MIT License](LICENSE). Bundled dependency licenses are in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). Typlog’s name and brand assets remain subject to their respective rights; MIT does not grant trademark rights.
