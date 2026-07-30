const GARBAGE = /�|\uFFFD|Ã[\x80-\xBF]|Â[\x80-\xBF]|â(?:€|€™|€œ|€œ)|ðŸ|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const SOURCE_NAMES = [
  "Sohu", "搜狐新闻", "搜狐科技", "搜狐", "QQ News", "腾讯新闻", "新华网", "光明网", "人民网",
  "中国新闻网", "央视网", "新浪科技", "网易科技", "凤凰科技", "澎湃新闻", "极客公园", "品玩",
  "量子位", "机器之心", "雷峰网", "爱范儿", "阿里云开发者社区", "腾讯云开发者社区",
  "华为云开发者联盟", "CSDN博客", "掘金",
];
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const hasEncodingGarbage = (value = "") =>
  GARBAGE.test(value) || /&(?:#\d{2,6}|#x[\da-f]{2,6}|amp|quot|apos|nbsp);/i.test(value);

export const stripSourceSuffix = (value = "", source = "") => {
  let text = value.trim();
  const aliases = [
    source,
    source.replace(/\s*(?:科技|新闻|中文|AI|人工智能|开发者社区|开发者|研究院|实验室|学院)$/i, ""),
    ...SOURCE_NAMES,
  ].filter((name) => name.length >= 2);
  const sourcePattern = aliases.map(escapeRegExp).join("|");
  if (sourcePattern) {
    const suffix = new RegExp(`\\s*(?:[-—–_|｜·]\\s*)+(?:${sourcePattern})(?:\\s*[-—–_|｜·])?\\s*$`, "i");
    const parenthetical = new RegExp(`\\s*[（(]\\s*(?:来源[:：]?\\s*)?(?:${sourcePattern})\\s*[)）]\\s*$`, "i");
    for (let index = 0; index < 4; index += 1) {
      const next = text.replace(suffix, "").replace(parenthetical, "").trim();
      if (next === text) break;
      text = next;
    }
  }
  return text
    .replace(/\s*(?:[-—–_|｜·]\s*)+(?:www\.)?[\w.-]+\.(?:com|cn|net|org|io)(?:\.cn)?\s*$/i, "")
    .trim();
};

export const cleanContentText = (value = "", source = "") =>
  stripSourceSuffix(value, source)
    .replace(/^\s*(?:[（(]?\d{1,2}[)）]?\s*[、,，.:：\-]\s*)+/, "")
    .replace(/(?:\.{3,}|…{2,})\s*$/g, "")
    .replace(/[，,]\s*[。.!！]/g, "。")
    .replace(/\s+/g, " ")
    .trim();

export const completeSentences = (value = "") =>
  cleanContentText(value).match(/[^。！？.!?]+[。！？.!?]/g)?.map((item) => item.trim()).filter(Boolean) ?? [];

export const isQualityTitle = (value = "", source = "") => {
  const text = cleanContentText(value, source);
  return text.length >= 6
    && text.length <= 180
    && !hasEncodingGarbage(text)
    && !/(?:\.{3,}|…+|[-—–_|｜·,:：，；、])\s*$/.test(text)
    && !/^\d+(?:\.\d+)*$/.test(text);
};

export const isQualitySummary = (value = "", minLength = 24) => {
  const text = cleanContentText(value);
  if (text.length < minLength || hasEncodingGarbage(text) || /(?:\.{3,}|…+|[-—–_|｜·,:：，；、])\s*$/.test(text)) return false;
  return completeSentences(text).length >= 1;
};

export const finishSentence = (value = "") => {
  const text = cleanContentText(value).replace(/[，；、\s]+$/, "");
  if (!text || hasEncodingGarbage(text)) return "";
  return /[。！？.!?]$/.test(text) ? text : `${text}。`;
};
