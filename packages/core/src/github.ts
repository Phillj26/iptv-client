export type GitHubSourceKind = "playlist" | "guide";

export interface GitHubSourceFile {
  kind: GitHubSourceKind;
  path: string;
  downloadUrl: string;
}

export interface GitHubRepositorySource {
  kind: "repository";
  owner: string;
  repo: string;
  ref?: string;
  path?: string;
}

export interface GitHubFileSource {
  kind: "file";
  owner: string;
  repo: string;
  ref: string;
  path: string;
  rawUrl: string;
  sourceKind: GitHubSourceKind;
}

export type GitHubSource = GitHubRepositorySource | GitHubFileSource;

function sourceKindForPath(path: string): GitHubSourceKind | undefined {
  const lowerPath = path.toLocaleLowerCase();
  if (/\.m3u8?$/.test(lowerPath)) {
    return "playlist";
  }
  if (/\.xml(?:tv)?$/.test(lowerPath)) {
    return "guide";
  }
  return undefined;
}

export function parseGitHubSourceUrl(value: string): GitHubSource {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") {
    throw new Error("GitHub sources must use HTTPS.");
  }

  if (url.hostname === "raw.githubusercontent.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 4) {
      throw new Error("Enter a GitHub repository or a valid raw file URL.");
    }
    const [owner, repo, ref, ...pathSegments] = segments;
    const path = decodeURIComponent(pathSegments.join("/"));
    const sourceKind = sourceKindForPath(path);
    if (!sourceKind) {
      throw new Error("The GitHub file must be an M3U, M3U8, XML, or XMLTV file.");
    }
    return { kind: "file", owner, repo, ref, path, rawUrl: url.href, sourceKind };
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Enter a github.com repository or raw.githubusercontent.com file URL.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error("Enter a GitHub repository in owner/repository format.");
  }
  const [owner, repo, view, ref, ...pathSegments] = segments;
  const normalizedRepo = repo.replace(/\.git$/, "");

  if (view === "blob" || view === "raw") {
    if (!ref || pathSegments.length === 0) {
      throw new Error("Enter a complete GitHub file URL.");
    }
    const path = decodeURIComponent(pathSegments.join("/"));
    const sourceKind = sourceKindForPath(path);
    if (!sourceKind) {
      throw new Error("The GitHub file must be an M3U, M3U8, XML, or XMLTV file.");
    }
    return {
      kind: "file",
      owner,
      repo: normalizedRepo,
      ref,
      path,
      rawUrl: `https://raw.githubusercontent.com/${owner}/${normalizedRepo}/${encodeURIComponent(ref)}/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`,
      sourceKind
    };
  }

  if (view === "tree") {
    return {
      kind: "repository",
      owner,
      repo: normalizedRepo,
      ref: ref || undefined,
      path: pathSegments.length > 0 ? decodeURIComponent(pathSegments.join("/")) : undefined
    };
  }

  return { kind: "repository", owner, repo: normalizedRepo };
}

export function gitHubSourceFileKind(path: string): GitHubSourceKind | undefined {
  return sourceKindForPath(path);
}
