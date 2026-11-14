export function parseAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const matcher = /([A-Za-z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g;

  for (const match of value.matchAll(matcher)) {
    const [, key, doubleQuoted, singleQuoted, bare] = match;
    attributes[key] = doubleQuoted ?? singleQuoted ?? bare ?? "";
  }

  return attributes;
}

export function firstUnquotedComma(value: string): number {
  let quote: string | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === '"' || character === "'") && value[index - 1] !== "\\") {
      quote = quote === character ? undefined : quote ?? character;
    } else if (character === "," && quote === undefined) {
      return index;
    }
  }

  return -1;
}

export function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

export function tagText(xml: string, tagName: string): string | undefined {
  const matcher = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(matcher);
  return match?.[1] === undefined ? undefined : decodeXmlEntities(match[1].replace(/<[^>]+>/g, ""));
}
