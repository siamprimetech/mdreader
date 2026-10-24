# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately
through [GitHub's security advisories](https://github.com/siamprimetech/mdreader/security/advisories/new), which is the
fastest route to the people who can act on it.

Please include what you found, how to reproduce it, and the version of the reader you were using. A proof of concept is
worth a great deal.

We will acknowledge the report, tell you what we make of it, and keep you informed as it is worked on. If a report turns
out not to be a vulnerability we will say so and tell you why. Please give us a reasonable period before disclosing the
problem publicly.

## Supported versions

Only the most recent release receives fixes. The reader updates itself, so running an old version is rarely necessary,
and an out-of-date reader will refuse an update whose signature was made with a key that has since been rotated.

| Version            | Supported |
|--------------------|-----------|
| The latest release | Yes       |
| Anything older     | No        |

## The update signing key

The reader verifies every update against a public key compiled into it, and the private key signs the releases. This is
the most sensitive thing in the project: whoever holds the private key can publish an update that every reader will
install.

If you believe the private key has been exposed, contact us **immediately**
and treat it as urgent. We will rotate the key, and the new key will be delivered with a release. Until that release is
out, readers will refuse updates signed with the old key — which is the correct behaviour, but it does mean people have
to install the new version by hand.

The key is held as a repository secret and is never committed, printed in a build log, or included in a release. It is
not shared outside the people who publish releases.

## Reading untrusted files

The reader is built to open documents you did not write, and takes that seriously:

- The markdown is sanitised before it reaches the page. Scripts, frames, inline styles and event handlers are removed,
  and only a known list of tags and attributes survives.
- Links to the web open in your browser rather than inside the reader, and links to other files are not followed.
- The reader never runs code from a document, and it never writes to the disk because of one.
- Images in a document are loaded only from the folder the document came from, or over the network — never from a path
  you did not open.
- Updates are only installed if their signature matches the key in the application.

If you find a way around any of that, please tell us.
