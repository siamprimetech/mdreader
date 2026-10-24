# Privacy policy

**Last updated: 22 October 2026**

Simple MD Reader is a Markdown reader. It opens documents that are already on your device, and it does nothing else with them.
It has no accounts, no analytics and no advertising, so there is very little privacy policy to write.

## The short version

The reader collects no personal information. It sends nothing about you, your documents or your device to us, and it
sells and shares nothing with anyone. The only network requests it ever makes are the ones you ask for: checking whether
a newer version exists, and loading images that a document itself points at.

## Who we are

Siam Prime Tech ("we", "us") is the developer of Simple MD Reader. This policy covers the Simple MD Reader applications published
under the `com.siamprimetech.mdreader` identifier, on Google Play and the Apple App Store.

Write to us through the [issue tracker](https://github.com/siamprimetech/mdreader/issues), or through the
[security advisories](https://github.com/siamprimetech/mdreader/security/advisories) if it is about a problem with
the reader.

## What the reader does not do

- It does not collect analytics, telemetry or usage statistics.
- It does not contain advertising or ad networks.
- It does not ask for an account, a sign-in or a profile.
- It does not send crash reports or diagnostics.
- It does not show advertising, and it does not build a profile of you.
- It does not upload, read or modify your documents beyond opening the ones you ask it to.

## What stays on your device

Two things are kept, and both are kept locally, on your device, in the application's own storage:

| What                                                              | Why                                      | Where         |
|-------------------------------------------------------------------|------------------------------------------|---------------|
| Your settings (theme, color palette, font and text size)         | so the reader looks the way you left it  | local storage |
| The documents you opened recently (the file path and the title)   | so the reader can offer them back to you | local storage |

The reader never keeps a copy of a document's contents. It never modifies a file, and it never writes a file because of
something in one.

Nothing about you is kept on our side. We run no servers for the reader and hold no database of readers.

## What leaves your device, and when

There are exactly three cases, and the first two happen only when you ask for them.

1. **Checking for an update.** When you press "Check for updates" in the about window, the reader asks GitHub for the
   latest release, and on the desktop it also fetches the release manifest and the update itself from
   `github.com/siamprimetech/mdreader`. These are ordinary HTTPS requests to GitHub. GitHub sees them as any server sees
   any request, including your IP address. We do not receive, log or store any of it.
2. **Images inside a document.** If a Markdown document refers to an image that lives on the web, the reader loads that
   image from the address the document gives. Whoever owns that address sees the request exactly as they would if you
   opened the document in a browser. Nothing is sent to us.
3. **Links you click.** Links in a document open in your browser rather than inside the reader. From that point on the
   website's own policy applies, not this one.

Nothing else in the application touches the network.

## Permissions, and what they are for

| Permission                           | Why the reader asks for it                                                                                                                                                     |
|--------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Access to files you choose           | The reader opens documents through the system's own file picker, or through "Open with" from the file manager. On Android it is granted access only to the file you handed it. |
| Network access (Android: `INTERNET`) | The update check, and images in a document that point at the web.                                                                                                              |
| Clipboard                            | Pasting markdown into the reader, which opens it as a new document. It uses the system's own paste action and reads only what you paste.                                       |

The reader does not ask for the camera, the microphone, location, contacts, SMS, phone state or the photo library, and
it does not ask for broad storage access.

## Fonts and libraries

The reader bundles its typefaces locally, so it never asks a font service for anything, and it never talks to Google
Fonts or any other content delivery network. Its libraries are open source and listed in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

The one third party involved is **GitHub, Inc.**, which hosts the project, the releases and the update manifest.
Requests to GitHub are handled
under [GitHub's privacy policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement), which
is between you and GitHub, not with us.

## Data retention and deletion

The settings and the recent documents list live on your device only. You can erase the history from within the reader,
and removing the application removes the rest. Because we hold no copy of anything, there is nothing for us to keep,
export or delete on request, but if you would like something done anyway, write to us, and we will do it.

## Children

The reader is a document viewer, and it is not directed at children. Because it collects no personal information at all,
it collects none from children either.

## Security

The reader sanitises the Markdown it displays, so a document cannot run code or reach into the application, and every
update is checked against a signing key before it is installed. The details are in [SECURITY.md](SECURITY.md). If you
find a way around any of it, please tell us.

## Your rights

Depending on where you live, you may have rights over personal data: to see it, to correct it, to erase it, to object to
its processing, or to complain to a regulator. Because the reader collects no personal data and shares none, there is
nothing for us to give you, change or erase. If you think we hold something about you, write to us, and we will look into
it and answer.

We do not transfer personal data across borders, for the same reason.

## Changes to this policy

If this policy changes, the date at the top of it changes with it, and the change is mentioned in the release notes of
the version it applies to.

## Contact

**Siam Prime Tech**
Issues: [github.com/siamprimetech/mdreader/issues](https://github.com/siamprimetech/mdreader/issues)
Advisories: [github.com/siamprimetech/mdreader/security/advisories](https://github.com/siamprimetech/mdreader/security/advisories)
Project: [github.com/siamprimetech/mdreader](https://github.com/siamprimetech/mdreader)

---

## For the store listing forms

Both stores ask for a summary, and this is the one to paste:

> Simple MD Reader collects no personal data. It has no accounts, no analytics and no advertising. Your settings and the list
> of documents you opened recently are stored only on your device and never leave it. The application does not upload
> your documents. The only network requests it makes are the update check you ask for, which goes to GitHub, and images
> that a document itself points at.

**Google Play, Data safety:** no data collected, no data shared.

**Apple, App Privacy:** no data collected. The app does not track, so the App Tracking Transparency prompt is not
needed.

**Privacy policy URL:** `https://siamprimetech.github.io/mdreader/privacy.html`, the page in `site/privacy.html`,
published by GitHub Pages. The plain file is at
`https://github.com/siamprimetech/mdreader/blob/main/PRIVACY.md`.

