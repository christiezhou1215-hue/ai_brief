const allowedDomains = [
  "qbitai.com", "jiqizhixin.com", "ai-era.net", "infoq.cn", "ithome.com", "36kr.com",
  "leiphone.com", "ifanr.com", "sspai.com", "huxiu.com", "tmtpost.com", "cnblogs.com",
  "oschina.net", "qq.com", "openai.com", "google.com", "deepmind.google", "anthropic.com",
  "meta.com", "microsoft.com", "nvidia.com", "huggingface.co", "github.blog", "mit.edu",
  "techcrunch.com", "theverge.com", "arxiv.org", "thepaper.cn", "cctv.com", "news.cn",
  "people.com.cn", "chinanews.com.cn", "sciencenet.cn", "stdaily.com", "caict.ac.cn",
  "cas.cn", "nda.gov.cn", "miit.gov.cn", "cac.gov.cn", "163.com", "sina.com.cn",
  "sohu.com", "ifeng.com", "geekpark.net", "pingwest.com", "chaping.cn", "csdn.net",
  "juejin.cn", "segmentfault.com", "aliyun.com", "baidu.com", "huaweicloud.com",
  "volcengine.com", "jdcloud.com", "meituan.com", "bytedance.com", "mi.com",
  "kuaishou.com", "antgroup.com", "noahlab.com.hk", "zhipuai.cn", "baichuan-ai.com",
  "moonshot.cn", "minimaxi.com", "01.ai", "sensetime.com", "iflytek.com", "deepseek.com",
  "pjlab.org.cn", "baai.ac.cn", "zhejianglab.com", "amazon.com", "apple.com", "ibm.com",
  "salesforceairesearch.com", "adobe.com", "stability.ai", "mistral.ai", "cohere.com",
  "perplexity.ai", "x.ai", "databricks.com", "snowflake.com", "mongodb.com", "vercel.com",
  "langchain.com", "llamaindex.ai", "together.ai", "replicate.com", "paperswithcode.com",
  "venturebeat.com", "wired.com", "arstechnica.com",
  "caixin.com", "yicai.com", "eeo.com.cn", "jiemian.com", "stcn.com", "cnstock.com",
  "cs.com.cn", "21jingji.com", "infzm.com", "nfnews.com", "beijingdaily.com.cn", "gmw.cn",
  "china.com.cn", "cyol.com", "cls.cn", "ndrc.gov.cn", "tsinghua.edu.cn", "pku.edu.cn",
  "fudan.edu.cn", "sjtu.edu.cn", "reuters.com", "apnews.com", "ft.com", "bloomberg.com",
  "nature.com", "science.org", "stanford.edu", "berkeley.edu", "allenai.org", "mozilla.ai",
];

export const safeArticleUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (host === "localhost" || host.endsWith(".local") || /^\d+(?:\.\d+){3}$/.test(host)) return null;
    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`)) ? url : null;
  } catch {
    return null;
  }
};
