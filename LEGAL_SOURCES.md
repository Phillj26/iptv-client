# Legal content and source policy

Streamline is a playlist client, not a stream catalogue. The project accepts only sources that satisfy all of the following:

1. The stream or provider page is supplied by the rights holder, an authorized distributor, or a government / public-domain institution.
2. The manifest identifies the official provenance URL and gives rights and availability notes.
3. A maintainer records the date and method used to validate it.
4. Any direct stream URL passes `pnpm validate:sources --online` before release.
5. The source does not provide unauthorized premium sports, movies, or television channels.

## Allowed integrations

- Official free provider pages and app handoffs.
- The viewer's own paid-service account, provider deep link, or an M3U URL explicitly authorized for that viewer.
- Public-domain or open-licensed media where the rights holder / archive provides the source.

## Not allowed

- Paid-channel restreams, credential lists, password sharing, or token scraping.
- Unofficial mirrors or GitHub playlists that do not document distribution authority.
- DRM circumvention, geoblocking bypasses, or proxying a subscriber's credentials.

## Initial manifest entries

The initial manifest uses official provider links plus one rights-documented public-domain playlist rather than brittle, undocumented media URLs. It also includes location-aware handoffs for local news and official free/subscription services for news, sports, and movies; these cards open the provider instead of extracting protected feeds:

- NASA+ is identified by NASA as a no-cost, ad-free service with live coverage and on-demand programming.
- The Library of Congress National Screening Room provides access to films whose rights status and approved viewing terms are documented by the Library.
- Local Now, NewsON, and Haystack News provide official local/news handoffs.
- Pluto TV and Tubi provide official free live/movie handoffs.
- Fubo and Netflix provide official subscription sports/movie handoffs.

The Public-domain movies playlist is published by `OnlineM3U` on GitHub, identifies its entries as public-domain works, and points to Internet Archive media files. The app imports the playlist links without rehosting them. The publisher's rights statement and each item's terms should be reviewed before reuse. Availability can vary by location, platform, and provider terms.

## Adding a direct public stream

Add a `direct-stream` entry only after manually confirming that it is a current HTTPS HLS stream from the authorized provider. Add a `curated-public-playlist` entry only when its publisher documents the rights basis and every media URL is checked. Record the verification in the manifest, run the online validator, and add a test fixture when the playlist format presents a new case. A successful network response alone is not proof of distribution rights.
