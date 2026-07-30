import { NextResponse } from "next/server";
import { cleanContentText, hasEncodingGarbage, isQualitySummary, isQualityTitle } from "../../../lib/content-quality";

export const dynamic = "force-dynamic";

type Source = { name: string; mark: string; url: string; homepage?: string; type?: "rss" | "atom"; tier: 1 | 2 | 3; chinese?: boolean };
type ChannelTier = "T1" | "T1.5" | "T2";
type AcquisitionMethod = "RSS" | "Atom" | "官方 API" | "HTML" | "搜索聚合" | "第三方接口";
type SelectionStatus = "精选" | "候选" | "观察" | "淘汰";
type ScoreBreakdown = {
  sourceQuality: number; industryImpact: number; recency: number;
  multiSource: number; completeness: number; userRelevance: number;
};
type SourceFetchResult = { items: NewsItem[]; rawItemCount: number };
type SelectionEvidence = {
  hasNewFact: boolean; coreChange: string; containsSpecifics: boolean;
  evidenceStrength: "强" | "中" | "弱"; likelyRepost: boolean;
  marketingRisk: boolean; uncertainty: string;
};
type SelectionBreakdown = {
  informationGain: number; industryImpact: number; evidenceStrength: number;
  specificity: number; timeliness: number; userRelevance: number;
};
export type NewsItem = {
  id: string; title: string; source: string; sourceMark: string; publishedAt: string; url: string;
  category: string; level: "重要" | "关注" | "一般"; score: number; trustScore: number;
  trustLabel: "高可信" | "较可信" | "待核实"; summary: string; tags: string[];
  related: number; sourceMentions: string[]; imageUrl?: string;
  recommendationReasons: string[]; importanceReason: string;
  eventTitle: string; eventKey: string; entities: string[]; keyFacts: string[];
  scoreBreakdown: ScoreBreakdown; uncertainty: string; trendKey: string;
  selectionScore: number; selectionStatus: SelectionStatus; selectionEvidence: SelectionEvidence;
  selectionBreakdown: SelectionBreakdown; scoringVersion: string;
};

const SCORING_VERSION = "selection-v12.0";

const newsSearch = (name: string, mark: string, query: string, chinese = true, tier: 1 | 2 | 3 = 2, homepage?: string): Source => ({
  name, mark, tier, chinese, homepage,
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} AI OR 人工智能`)}&hl=${chinese ? "zh-CN" : "en-US"}&gl=${chinese ? "CN" : "US"}&ceid=${chinese ? "CN:zh-Hans" : "US:en"}`,
});

const sources: Source[] = [
  { name: "量子位", mark: "量", url: "https://www.qbitai.com/feed", tier: 2, chinese: true },
  { name: "机器之心", mark: "机", url: "https://www.jiqizhixin.com/rss", tier: 2, chinese: true },
  { name: "新智元", mark: "新", url: "https://www.ai-era.net/feed", tier: 2, chinese: true },
  { name: "InfoQ 中文", mark: "IQ", url: "https://www.infoq.cn/feed", tier: 2, chinese: true },
  { name: "IT之家", mark: "IT", url: "https://www.ithome.com/rss/", tier: 2, chinese: true },
  { name: "36氪", mark: "36", url: "https://36kr.com/feed", tier: 2, chinese: true },
  { name: "雷峰网", mark: "雷", url: "https://www.leiphone.com/feed", tier: 2, chinese: true },
  { name: "爱范儿", mark: "爱", url: "https://www.ifanr.com/feed", tier: 2, chinese: true },
  { name: "少数派", mark: "少", url: "https://sspai.com/feed", tier: 2, chinese: true },
  { name: "虎嗅", mark: "虎", url: "https://www.huxiu.com/rss/0.xml", tier: 2, chinese: true },
  { name: "钛媒体", mark: "钛", url: "https://www.tmtpost.com/rss.xml", tier: 2, chinese: true },
  { name: "博客园", mark: "博", url: "https://feed.cnblogs.com/blog/sitehome/rss", type: "atom", tier: 3, chinese: true },
  { name: "开源中国", mark: "OS", url: "https://www.oschina.net/news/rss", tier: 3, chinese: true },
  { name: "腾讯云开发者", mark: "腾", url: "https://cloud.tencent.com/developer/rss", tier: 1, chinese: true },
  { name: "OpenAI", mark: "O", url: "https://openai.com/news/rss.xml", tier: 1 },
  { name: "Google AI", mark: "G", url: "https://blog.google/technology/ai/rss/", tier: 1 },
  { name: "Google DeepMind", mark: "DM", url: "https://deepmind.google/blog/rss.xml", tier: 1 },
  { name: "Anthropic", mark: "AN", url: "https://www.anthropic.com/rss.xml", tier: 1 },
  { name: "Meta AI", mark: "M", url: "https://ai.meta.com/blog/rss/", tier: 1 },
  { name: "Microsoft Research", mark: "MS", url: "https://www.microsoft.com/en-us/research/feed/", tier: 1 },
  { name: "NVIDIA AI", mark: "NV", url: "https://blogs.nvidia.com/blog/category/generative-ai/feed/", tier: 1 },
  { name: "Hugging Face", mark: "HF", url: "https://huggingface.co/blog/feed.xml", tier: 1 },
  { name: "GitHub AI", mark: "GH", url: "https://github.blog/ai-and-ml/feed/", tier: 1 },
  { name: "MIT AI", mark: "MIT", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", tier: 1 },
  { name: "TechCrunch AI", mark: "TC", url: "https://techcrunch.com/category/artificial-intelligence/feed/", tier: 2 },
  { name: "The Verge AI", mark: "TV", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", tier: 2 },
  { name: "arXiv AI", mark: "AX", url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending", type: "atom", tier: 1 },
  { name: "arXiv LLM", mark: "CL", url: "https://export.arxiv.org/api/query?search_query=cat:cs.CL&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending", type: "atom", tier: 1 },
  ...[
    ["澎湃科技","澎","site:thepaper.cn","https://www.thepaper.cn"],
    ["央视网科技","央","site:news.cctv.com tech","https://news.cctv.com"],
    ["新华网科技","华","site:news.cn tech","https://www.news.cn"],
    ["人民网科技","人","site:people.com.cn tech","http://it.people.com.cn"],
    ["中国新闻网科技","中","site:chinanews.com tech","https://www.chinanews.com.cn"],
    ["中国科学报","科","site:sciencenet.cn","https://news.sciencenet.cn"],
    ["科技日报","技","site:stdaily.com","https://www.stdaily.com"],
    ["中国信通院","CA","site:caict.ac.cn","https://www.caict.ac.cn"],
    ["中国科学院","CAS","site:cas.cn","https://www.cas.cn"],
    ["国家数据局","数","site:nda.gov.cn","https://www.nda.gov.cn"],
    ["工信微报","工","工信部 人工智能","https://www.miit.gov.cn"],
    ["网信中国","网","site:cac.gov.cn 人工智能","https://www.cac.gov.cn"],
    ["腾讯科技","TX","site:news.qq.com tech","https://new.qq.com/ch/tech"],
    ["网易科技","易","site:163.com tech","https://tech.163.com"],
    ["新浪科技","浪","site:tech.sina.com.cn","https://tech.sina.com.cn"],
    ["搜狐科技","狐","site:sohu.com tech","https://it.sohu.com"],
    ["凤凰科技","凤","site:ifeng.com tech","https://tech.ifeng.com"],
    ["极客公园","极","site:geekpark.net","https://www.geekpark.net"],
    ["品玩","品","site:pingwest.com","https://www.pingwest.com"],
    ["差评","差","site:chaping.cn","https://www.chaping.cn"],
    ["APPSO","AP","site:ifanr.com appso","https://www.ifanr.com/appso"],
    ["CSDN","CS","site:csdn.net 人工智能","https://www.csdn.net"],
    ["掘金","掘","site:juejin.cn AI","https://juejin.cn"],
    ["SegmentFault","SF","site:segmentfault.com AI","https://segmentfault.com"],
    ["阿里云开发者","阿","site:developer.aliyun.com AI","https://developer.aliyun.com"],
    ["百度智能云","百","site:cloud.baidu.com AI","https://cloud.baidu.com"],
    ["华为云","HW","site:huaweicloud.com AI","https://www.huaweicloud.com"],
    ["火山引擎","火","site:volcengine.com AI","https://www.volcengine.com"],
    ["京东云开发者","JD","site:jdcloud.com AI","https://www.jdcloud.com"],
    ["美团技术团队","美","site:tech.meituan.com AI","https://tech.meituan.com"],
    ["字节跳动技术团队","字","site:bytedance.com tech AI","https://www.bytedance.com"],
    ["腾讯技术工程","TQ","腾讯技术工程 人工智能","https://cloud.tencent.com/developer"],
    ["小米技术","米","小米技术 人工智能","https://www.mi.com"],
    ["快手技术","快","快手技术 人工智能","https://www.kuaishou.com"],
    ["蚂蚁技术","蚁","蚂蚁技术 人工智能","https://www.antgroup.com"],
    ["百度研究院","BR","site:research.baidu.com AI","http://research.baidu.com"],
    ["阿里达摩院","达","site:damo.alibaba.com","https://damo.alibaba.com"],
    ["腾讯 AI Lab","TL","site:ai.tencent.com","https://ai.tencent.com"],
    ["华为诺亚方舟","诺","site:noahlab.com.hk","https://www.noahlab.com.hk"],
    ["智谱 AI","智","site:zhipuai.cn","https://www.zhipuai.cn"],
    ["百川智能","川","site:baichuan-ai.com","https://www.baichuan-ai.com"],
    ["月之暗面","月","site:moonshot.cn","https://www.moonshot.cn"],
    ["MiniMax","MM","site:minimaxi.com","https://www.minimaxi.com"],
    ["零一万物","零","site:01.ai","https://www.01.ai"],
    ["商汤科技","商","site:sensetime.com","https://www.sensetime.com"],
    ["科大讯飞","讯","site:iflytek.com","https://www.iflytek.com"],
    ["DeepSeek","DS","site:deepseek.com","https://www.deepseek.com"],
    ["上海人工智能实验室","浦","site:pjlab.org.cn","https://www.pjlab.org.cn"],
    ["北京智源研究院","源","site:baai.ac.cn","https://www.baai.ac.cn"],
    ["之江实验室","之","site:zhejianglab.com","https://www.zhejianglab.com"],
  ].map(([name, mark, query, homepage]) => newsSearch(name, mark, query, true, 2, homepage)),
  ...[
    ["AWS Machine Learning","AWS","site:aws.amazon.com/blogs/machine-learning","https://aws.amazon.com/blogs/machine-learning/"],
    ["Apple Machine Learning","APL","site:machinelearning.apple.com","https://machinelearning.apple.com"],
    ["IBM Research","IBM","site:research.ibm.com AI","https://research.ibm.com"],
    ["Salesforce AI","SFDC","site:blog.salesforceairesearch.com","https://blog.salesforceairesearch.com"],
    ["Adobe Research","ADB","site:research.adobe.com AI","https://research.adobe.com"],
    ["Stability AI","ST","site:stability.ai/news","https://stability.ai/news"],
    ["Mistral AI","MI","site:mistral.ai/news","https://mistral.ai/news"],
    ["Cohere","CO","site:cohere.com/blog","https://cohere.com/blog"],
    ["Perplexity","PX","site:perplexity.ai/hub/blog","https://www.perplexity.ai/hub/blog"],
    ["xAI","XA","site:x.ai/news","https://x.ai/news"],
    ["Databricks AI","DB","site:databricks.com/blog AI","https://www.databricks.com/blog"],
    ["Snowflake AI","SN","site:snowflake.com/blog AI","https://www.snowflake.com/blog"],
    ["MongoDB AI","MDB","site:mongodb.com/blog AI","https://www.mongodb.com/blog"],
    ["Vercel AI","VC","site:vercel.com/blog AI","https://vercel.com/blog"],
    ["LangChain","LC","site:blog.langchain.com","https://blog.langchain.com"],
    ["LlamaIndex","LI","site:llamaindex.ai/blog","https://www.llamaindex.ai/blog"],
    ["Together AI","TG","site:together.ai/blog","https://www.together.ai/blog"],
    ["Replicate","RP","site:replicate.com/blog","https://replicate.com/blog"],
    ["Papers with Code","PWC","site:paperswithcode.com","https://paperswithcode.com"],
    ["VentureBeat AI","VB","site:venturebeat.com/ai","https://venturebeat.com/ai/"],
    ["WIRED AI","WI","site:wired.com/tag/artificial-intelligence","https://www.wired.com/tag/artificial-intelligence/"],
    ["Ars Technica AI","ARS","site:arstechnica.com/ai","https://arstechnica.com/ai/"],
  ].map(([name, mark, query, homepage]) => newsSearch(name, mark, query, false, 2, homepage)),
  ...[
    ["财新科技","财","site:caixin.com 科技 人工智能","https://www.caixin.com/technology/"],
    ["第一财经科技","一","site:yicai.com 科技 人工智能","https://www.yicai.com/technology/"],
    ["经济观察报科技","经","site:eeo.com.cn 科技 人工智能","http://www.eeo.com.cn/"],
    ["界面新闻科技","界","site:jiemian.com 科技 人工智能","https://www.jiemian.com/lists/280.html"],
    ["证券时报科技","证","site:stcn.com 科技 人工智能","https://www.stcn.com/"],
    ["上海证券报科技","上","site:cnstock.com 科技 人工智能","https://www.cnstock.com/"],
    ["中国证券报科技","报","site:cs.com.cn 科技 人工智能","https://www.cs.com.cn/"],
    ["21世纪经济报道","21","site:21jingji.com 科技 人工智能","https://www.21jingji.com/"],
    ["南方周末科技","南","site:infzm.com 科技 人工智能","https://www.infzm.com/"],
    ["南方都市报 AI","都","site:nfnews.com 人工智能 科技","https://www.nfnews.com/"],
    ["北京日报科技","京","site:beijingdaily.com.cn 科技 人工智能","https://www.beijingdaily.com.cn/"],
    ["光明网科技","光","site:gmw.cn 科技 人工智能","https://tech.gmw.cn/"],
    ["中国网科技","国","site:china.com.cn 科技 人工智能","http://tech.china.com.cn/"],
    ["中国青年报科技","青","site:cyol.com 科技 人工智能","https://www.cyol.com/"],
    ["财联社科技","联","site:cls.cn 科技 人工智能","https://www.cls.cn/"],
    ["国家发改委数字经济","发","site:ndrc.gov.cn 数字经济 人工智能","https://www.ndrc.gov.cn/"],
    ["清华大学智能产业研究院","清","site:air.tsinghua.edu.cn","https://air.tsinghua.edu.cn/"],
    ["北京大学人工智能研究院","北","site:ai.pku.edu.cn","https://www.ai.pku.edu.cn/"],
    ["复旦大学计算机学院","复","site:cs.fudan.edu.cn 人工智能","https://cs.fudan.edu.cn/"],
    ["上海交大人工智能研究院","交","site:ai.sjtu.edu.cn","https://ai.sjtu.edu.cn/"],
  ].map(([name, mark, query, homepage]) => newsSearch(name, mark, query, true, 2, homepage)),
  ...[
    ["科技部","科部","site:most.gov.cn 人工智能","https://www.most.gov.cn/"],
    ["教育部科技司","教","site:moe.gov.cn 人工智能 科技","http://www.moe.gov.cn/"],
    ["国家自然科学基金委","基金","site:nsfc.gov.cn 人工智能","https://www.nsfc.gov.cn/"],
    ["中国计算机学会","CCF","site:ccf.org.cn 人工智能","https://www.ccf.org.cn/"],
    ["中国人工智能学会","CAAI","site:caai.cn 人工智能","https://www.caai.cn/"],
    ["中国电子学会","电","site:cie-info.org.cn 人工智能","https://www.cie-info.org.cn/"],
    ["中国互联网协会","互","site:isc.org.cn 人工智能","https://www.isc.org.cn/"],
    ["全国信标委人工智能分委会","信标","人工智能 分委会 标准 新闻","https://www.cesi.cn/"],
    ["北京市科委","北京","site:kw.beijing.gov.cn 人工智能","https://kw.beijing.gov.cn/"],
    ["上海市科委","上海","site:stcsm.sh.gov.cn 人工智能","https://stcsm.sh.gov.cn/"],
    ["广东省科技厅","广东","site:gdstc.gd.gov.cn 人工智能","http://gdstc.gd.gov.cn/"],
    ["浙江省科技厅","浙江","site:kjt.zj.gov.cn 人工智能","https://kjt.zj.gov.cn/"],
    ["深圳市科创委","深圳","site:stic.sz.gov.cn 人工智能","https://stic.sz.gov.cn/"],
    ["中国科学技术大学","中科大","site:ustc.edu.cn 人工智能","https://www.ustc.edu.cn/"],
    ["浙江大学人工智能研究所","浙大","site:zju.edu.cn 人工智能 研究院","https://www.zju.edu.cn/"],
    ["南京大学人工智能学院","南大","site:ai.nju.edu.cn","https://ai.nju.edu.cn/"],
    ["哈尔滨工业大学人工智能研究院","哈工","site:hit.edu.cn 人工智能","https://www.hit.edu.cn/"],
    ["北京航空航天大学人工智能研究院","北航","site:buaa.edu.cn 人工智能","https://www.buaa.edu.cn/"],
    ["西安交通大学人工智能学院","西交","site:iair.xjtu.edu.cn","http://iair.xjtu.edu.cn/"],
    ["华中科技大学人工智能学院","华科","site:aia.hust.edu.cn","http://aia.hust.edu.cn/"],
    ["武汉大学人工智能研究院","武大","site:whu.edu.cn 人工智能","https://www.whu.edu.cn/"],
    ["中山大学人工智能学院","中大","site:sysu.edu.cn 人工智能","https://www.sysu.edu.cn/"],
    ["华南理工大学未来技术学院","华工","site:scut.edu.cn 人工智能","https://www.scut.edu.cn/"],
    ["电子科技大学计算机学院","成电","site:uestc.edu.cn 人工智能","https://www.uestc.edu.cn/"],
    ["西安电子科技大学人工智能学院","西电","site:xidian.edu.cn 人工智能","https://www.xidian.edu.cn/"],
    ["同济大学人工智能研究院","同济","site:tongji.edu.cn 人工智能","https://www.tongji.edu.cn/"],
    ["中国人民大学高瓴人工智能学院","高瓴","site:ai.ruc.edu.cn","http://ai.ruc.edu.cn/"],
    ["南开大学人工智能学院","南开","site:ai.nankai.edu.cn","https://ai.nankai.edu.cn/"],
    ["天津大学智能与计算学部","天大","site:tic.tju.edu.cn 人工智能","http://tic.tju.edu.cn/"],
    ["东南大学人工智能学院","东南","site:seu.edu.cn 人工智能","https://www.seu.edu.cn/"],
    ["北京邮电大学人工智能学院","北邮","site:bupt.edu.cn 人工智能","https://www.bupt.edu.cn/"],
    ["北京理工大学计算机学院","北理","site:bit.edu.cn 人工智能","https://www.bit.edu.cn/"],
    ["鹏城实验室","鹏","site:pcl.ac.cn 人工智能","https://www.pcl.ac.cn/"],
    ["IDEA 研究院","IDEA","site:idea.edu.cn 人工智能","https://www.idea.edu.cn/"],
    ["粤港澳大湾区数字经济研究院","湾","数字经济研究院 IDEA 人工智能","https://www.idea.edu.cn/"],
    ["中科院自动化所","自动","site:ia.cas.cn 人工智能","http://www.ia.cas.cn/"],
    ["中科院计算所","计算","site:ict.ac.cn 人工智能","http://www.ict.ac.cn/"],
    ["中科院软件所","软件","site:iscas.ac.cn 人工智能","http://www.iscas.ac.cn/"],
    ["微软亚洲研究院","MSRA","site:microsoft.com/zh-cn/research 人工智能","https://www.microsoft.com/zh-cn/research/"],
    ["联想研究院","联想","联想研究院 人工智能","https://research.lenovo.com/"],
    ["OPPO 研究院","OP","site:oppo.com 研究院 人工智能","https://www.oppo.com/cn/"],
    ["vivo AI Lab","VO","vivo AI Lab 人工智能","https://www.vivo.com.cn/"],
    ["京东探索研究院","京东","京东探索研究院 人工智能","https://www.jd.com/"],
    ["字节跳动 Seed","Seed","字节跳动 Seed 大模型","https://seed.bytedance.com/"],
    ["腾讯混元","混元","腾讯混元 大模型","https://hunyuan.tencent.com/"],
    ["阿里通义","通义","阿里 通义 大模型","https://tongyi.aliyun.com/"],
    ["百度文心","文心","百度 文心 大模型","https://yiyan.baidu.com/"],
    ["华为盘古","盘古","华为 盘古大模型","https://www.huaweicloud.com/product/pangu.html"],
    ["火山方舟","方舟","火山方舟 大模型","https://www.volcengine.com/product/ark"],
    ["魔搭社区","魔搭","site:modelscope.cn AI","https://modelscope.cn/"],
    ["飞桨社区","飞桨","site:paddlepaddle.org.cn AI","https://www.paddlepaddle.org.cn/"],
    ["MindSpore 社区","昇思","site:mindspore.cn AI","https://www.mindspore.cn/"],
    ["OpenI 启智社区","启智","site:openi.org.cn 人工智能","https://openi.org.cn/"],
    ["Gitee AI","码云","site:gitee.com AI 模型","https://ai.gitee.com/"],
    ["Datawhale","DW","site:datawhale.cn 人工智能","https://www.datawhale.cn/"],
    ["极市平台","极市","site:extremevision.com.cn AI","https://www.extremevision.com.cn/"],
    ["PaperWeekly","PW","PaperWeekly 人工智能 论文","https://www.paperweekly.site/"],
    ["AI 研习社","研","site:yanxishe.com 人工智能","https://www.yanxishe.com/"],
    ["51CTO AI","51","site:51cto.com AI 大模型","https://www.51cto.com/"],
    ["华为开发者联盟","华开","site:developer.huawei.com AI","https://developer.huawei.com/consumer/cn/"],
    ["百度开发者中心","百度开","site:developer.baidu.com AI","https://developer.baidu.com/"],
    ["甲子光年","甲","site:jazzyear.com 人工智能","https://www.jazzyear.com/"],
    ["AI 科技评论","AI评","AI科技评论 人工智能","https://www.leiphone.com/category/ai"],
    ["镁客网","镁","site:im2maker.com 人工智能","https://www.im2maker.com/"],
    ["亿欧科技","亿","site:iyiou.com 人工智能","https://www.iyiou.com/"],
    ["创业邦科技","创","site:cyzone.cn 人工智能","https://www.cyzone.cn/"],
    ["投资界科技","投","site:pedaily.cn 人工智能","https://www.pedaily.cn/"],
    ["DoNews 科技","DN","site:donews.com 人工智能","https://www.donews.com/"],
    ["TechWeb","TW","site:techweb.com.cn 人工智能","http://www.techweb.com.cn/"],
    ["每日经济新闻科技","每","site:nbd.com.cn 人工智能 科技","https://www.nbd.com.cn/"],
    ["经济日报科技","经日","site:ce.cn 人工智能 科技","http://www.ce.cn/"],
    ["中国经营报科技","经营","site:cb.com.cn 人工智能 科技","http://www.cb.com.cn/"],
    ["环球网科技","环球","site:huanqiu.com 人工智能 科技","https://tech.huanqiu.com/"],
    ["上观新闻科技","上观","site:jfdaily.com 人工智能 科技","https://www.jfdaily.com/"],
    ["新京报科技","新京","site:bjnews.com.cn 人工智能 科技","https://www.bjnews.com.cn/"],
    ["深圳特区报科技","深报","site:sznews.com 人工智能 科技","https://www.sznews.com/"],
    ["羊城晚报科技","羊","site:ycwb.com 人工智能 科技","https://www.ycwb.com/"],
    ["阶跃星辰","阶","site:stepfun.com 人工智能","https://www.stepfun.com/"],
    ["面壁智能","面","site:modelbest.cn 人工智能","https://www.modelbest.cn/"],
    ["生数科技","生","site:shengshu-ai.com 人工智能","https://www.shengshu-ai.com/"],
    ["无问芯穹","芯穹","site:infinigence.ai 人工智能","https://www.infinigence.ai/"],
    ["硅基流动","硅","site:siliconflow.cn 人工智能","https://siliconflow.cn/"],
    ["秘塔科技","秘","site:metaso.cn 人工智能","https://metaso.cn/"],
    ["云天励飞","云","site:intellif.com 人工智能","https://www.intellif.com/"],
    ["第四范式","四","site:4paradigm.com 人工智能","https://www.4paradigm.com/"],
    ["寒武纪","寒","site:cambricon.com 人工智能 芯片","https://www.cambricon.com/"],
    ["摩尔线程","摩","site:moorethreads.com 人工智能","https://www.moorethreads.com/"],
    ["地平线机器人","地","site:horizon.auto 人工智能","https://www.horizon.auto/"],
  ].map(([name, mark, query, homepage]) => newsSearch(name, mark, query, true, 2, homepage)),
  ...[
    ["Reuters Technology","RT","site:reuters.com/technology artificial intelligence","https://www.reuters.com/technology/"],
    ["AP Technology","APN","site:apnews.com technology artificial intelligence","https://apnews.com/technology"],
    ["Financial Times AI","FT","site:ft.com/artificial-intelligence","https://www.ft.com/artificial-intelligence"],
    ["Bloomberg Technology","BB","site:bloomberg.com/technology artificial intelligence","https://www.bloomberg.com/technology"],
    ["Nature Machine Intelligence","NMI","site:nature.com/natmachintell","https://www.nature.com/natmachintell/"],
    ["Science AI","SCI","site:science.org artificial intelligence","https://www.science.org/"],
    ["Stanford HAI","HAI","site:hai.stanford.edu news","https://hai.stanford.edu/news"],
    ["Berkeley AI Research","BAIR","site:bair.berkeley.edu/blog","https://bair.berkeley.edu/blog/"],
    ["Allen Institute for AI","AI2","site:allenai.org/news","https://allenai.org/news"],
    ["Mozilla AI","MOZ","site:blog.mozilla.ai","https://blog.mozilla.ai/"],
  ].map(([name, mark, query, homepage]) => newsSearch(name, mark, query, false, 2, homepage)),
];

const decode = (value = "") => {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i += 1) text = text
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
};
const field = (block: string, tag: string) => block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
const linkFor = (block: string, atom: boolean) => atom
  ? block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? ""
  : decode(field(block, "link"));
const completeSentence = (value: string) => /[。！？.!?]$/.test(value) ? value : `${value}。`;
const stripNoise = (value: string) => value
  .replace(/^\s*(?:[（(]?\d{1,2}[)）]?\s*[、,，.:：\-]\s*)+/, "")
  .replace(/\s*(?:[-—–_|｜·]\s*)+(?:Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻|新华网|光明网|人民网)(?:\s*[-—–_|｜·])?\s*$/gi, "")
  .replace(/\s*[（(]\s*(?:来源[:：]?)?\s*(?:Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻|新华网|光明网|人民网)\s*[)）]\s*$/gi, "")
  .replace(/([A-Za-z]+-\d+(?:\.\d+)*)\.(?=\s*$)/, "$1")
  .replace(/[，,]\s*[。.!！]/g, "。")
  .replace(/\s+/g, " ")
  .trim();
const short = (value: string, max = 150) => {
  const text = stripNoise(decode(value)
    .replace(/^[·•\-–—\s]+/, ""))
    .replace(/(?:\.{3,}|…{2,})/g, "。")
    .replace(/([。！？])\s*[·•]\s*/g, "$1")
    .replace(/#\S+/g, "")
    .replace(/欢迎关注[\s\S]*$/i, "")
    .replace(/(?:微信公众号|微信号|更多精彩内容)[\s\S]*$/i, "")
    .replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]/g)?.map((item) => item.trim()).filter((item) => item.length >= 12) ?? [];
  const selected = sentences.slice(0, 3).join("");
  if (selected && selected.length <= max + 30) return selected;
  const candidate = selected || completeSentence(text);
  if (candidate.length <= max) return completeSentence(candidate);
  const completeWithinLimit = sentences.filter((sentence, index) => sentences.slice(0, index + 1).join("").length <= max).join("");
  if (completeWithinLimit.length >= 35) return completeWithinLimit;
  const cut = candidate.slice(0, max + 1);
  const boundary = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("！"), cut.lastIndexOf("？"), cut.lastIndexOf("；"), cut.lastIndexOf("，"));
  return completeSentence(cut.slice(0, boundary >= 55 ? boundary : max).replace(/[，；、\s]+$/, "").replace(/\s*(?:\.{3,}|…+)\s*$/, ""));
};
const cleanTitle = (value: string, sourceName = "") => {
  let text = stripNoise(decode(value).replace(/(?:\.{3,}|…+)/g, " "));
  const aliases = sourceName ? [
    sourceName,
    sourceName.replace(/\s*(?:科技|新闻|中文|AI|人工智能|开发者社区|开发者|研究院|实验室|学院)$/i, ""),
  ].filter((name) => name.length >= 2) : [];
  aliases.forEach((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\s*(?:[-—–_|｜]|·)\\s*${escaped}\\s*$`, "i"), "").trim();
  });
  text = text
    .replace(/\s*(?:[-—–_|｜]|·)+\s*(?:阿里云开发者社区|腾讯云开发者社区|华为云开发者联盟|CSDN博客|掘金|光明网|新华网|人民网|中国新闻网|央视网|新浪科技|搜狐(?:新闻|科技)?|网易科技|凤凰科技|澎湃新闻|极客公园|品玩|量子位|机器之心|雷峰网|Sohu|QQ\s*News|腾讯新闻)(?:\s*(?:[-—–_|｜]|·))?\s*$/i, "")
    .replace(/\s*(?:[-—–_|｜]|·)\s*(?:www\.)?[\w.-]+\.(?:com|cn|net|org)(?:\.cn)?\s*$/i, "")
    .trim();
  return cleanContentText(stripNoise(text), sourceName);
};
const splitDigestTitle = (title: string) => {
  const digest = /^(?:早报|晚报|晨报|日报|速览|今日热点|科技早知道)\s*[｜|:：]/.test(title);
  const body = title.replace(/^(?:早报|晚报|晨报|日报|速览|今日热点|科技早知道)\s*[｜|:：]\s*/, "");
  const parts = body.split(/\s*(?:\/|｜|\|)\s*/).map((part) => part.trim()).filter((part) => part.length >= 8);
  return digest && parts.length >= 2 ? parts.slice(0, 8) : [title];
};
const focusedSummary = (headline: string, fullSummary: string) => {
  const keywords = headline.toLowerCase().match(/[a-z][a-z0-9.-]{2,}|[\u4e00-\u9fff]{2,6}/g)?.filter((word) => !/发布|推出|正式|宣布|今日|最新/.test(word)) ?? [];
  const segments = fullSummary.split(/(?<=[。！？.!?])\s*|[·•]\s*/).map((item) => item.trim()).filter((item) => item.length >= 12);
  const matched = segments.filter((segment) => keywords.some((word) => segment.toLowerCase().includes(word))).slice(0, 2);
  return short(matched.join(""), 220) || completeSentence(headline);
};
const isAi = (text: string) => /人工智能|大模型|模型|智能体|机器人|算法|芯片|\bai\b|gpt|claude|gemini|deepseek|llm|agent/i.test(text);
const categoryFor = (text: string) => /agent|智能体|copilot/i.test(text) ? "AI Agent"
  : /code|coding|developer|编程|开发者/i.test(text) ? "AI 编程"
  : /image|video|multimodal|多模态|视频|图像|语音/i.test(text) ? "多模态"
  : /open.?source|开源|github/i.test(text) ? "开源项目"
  : /paper|research|benchmark|arxiv|研究|论文/i.test(text) ? "学术研究"
  : /model|gpt|gemini|claude|模型/i.test(text) ? "模型发布" : "行业动态";
const importanceFor = (category: string, text: string) =>
  /芯片|算力|gpu|nvidia|amd/i.test(text) ? "这项变化可能影响 AI 基础设施的供给、成本与竞争格局。"
  : /政策|监管|法规|标准|安全|治理/i.test(text) ? "这项变化可能影响 AI 产品的准入要求、安全边界与落地节奏。"
  : category === "模型发布" ? "这项变化可能影响模型能力边界、调用成本与产品竞争格局。"
  : category === "AI Agent" ? "这项变化反映智能体正在从能力演示走向真实工作流程与企业部署。"
  : category === "AI 编程" ? "这项变化可能改变开发工具的使用方式、研发效率与软件交付流程。"
  : category === "开源项目" ? "这项变化可能降低技术使用门槛，并加快开发者生态与应用扩散。"
  : category === "学术研究" ? "这项研究为模型能力、评测方法或技术路线提供了新的可验证证据。"
  : "这项变化可能影响 AI 产品落地、商业竞争或行业资源配置。";
const trendFor = (category: string, text: string) =>
  /政策|监管|法规|标准|安全|治理|合规/i.test(text) ? "AI 安全、治理与标准"
  : /成本|价格|降价|token|推理效率/i.test(text) ? "模型成本与推理效率"
  : /芯片|算力|gpu|nvidia|amd|数据中心/i.test(text) ? "算力与基础设施"
  : category === "AI Agent" ? "智能体与工作流"
  : category === "AI 编程" ? "AI 开发工具"
  : category === "开源项目" ? "开源生态"
  : category === "学术研究" ? "前沿研究"
  : category === "模型发布" ? "模型能力演进"
  : "AI 产品与行业应用";
const sourceClassFor = (source: Source) => {
  if (source.tier === 1) return "一手官方来源";
  if (
    source.tier === 3
    || /开发者|社区|博客园|CSDN|掘金|SegmentFault|开源中国|Datawhale|51CTO|PaperWeekly|魔搭|飞桨|MindSpore|OpenI|Gitee/i.test(source.name)
  ) return "开发者与社区来源";
  if (
    /新华|人民|央视|中新|澎湃|财新|第一财经|经济|证券|日报|晚报|周末|都市|光明|中国网|青年报|财联社|界面|新浪|搜狐|网易|凤凰|环球|上观|南方|腾讯科技/i.test(source.name)
  ) return "综合新闻媒体";
  return "专业科技媒体";
};
const channelProfileFor = (source: Source): {
  channelTier: ChannelTier; acquisitionMethod: AcquisitionMethod; monitoringScope: string;
} => {
  const isSearchAggregation = /news\.google\.com\/rss\/search/.test(source.url);
  const official = sourceClassFor(source) === "一手官方来源";
  const broadAnnouncementChannel = /Newsroom|新闻中心|全站|科技$|日报|晚报|综合/i.test(source.name);
  const socialChannel = /\bX\b|Twitter|微博|官微|官方账号/i.test(source.name);
  const channelTier: ChannelTier = official && !isSearchAggregation && !broadAnnouncementChannel
    ? "T1"
    : official || socialChannel || source.tier === 2
      ? "T1.5"
      : "T2";
  const acquisitionMethod: AcquisitionMethod = isSearchAggregation
    ? "搜索聚合"
    : source.type === "atom"
      ? "Atom"
      : "RSS";
  const monitoringScope = isSearchAggregation
    ? "指定域名的 AI 相关内容"
    : /artificial|machine-learning|generative-ai|\/ai(?:\/|$)|cs\.AI|cs\.CL/i.test(source.url)
      ? "AI 专题或指定栏目"
      : official
        ? "官方发布通道"
        : "站点资讯流，经 AI 相关性过滤";
  return { channelTier, acquisitionMethod, monitoringScope };
};
const selectionEvidenceFor = (
  title: string,
  summary: string,
  source: Source,
  scoreBreakdown: ScoreBreakdown,
): { evidence: SelectionEvidence; breakdown: SelectionBreakdown; score: number; status: SelectionStatus } => {
  const text = `${title} ${summary}`;
  const specifics = (text.match(/\d+(?:\.\d+)?%?|20\d{2}年|\d+亿元|\d+亿美元|\d+[万亿]|API|开源|正式发布|正式上线/gi) ?? []).length;
  const likelyRepost = /转载|综合自|消息称|据.*报道|援引|早报|晚报|日报|周报|盘点|合集/i.test(text);
  const marketingRisk = /限时|优惠|扫码|点击领取|欢迎关注|火爆|震撼|颠覆世界|必看|速抢/i.test(text);
  const anonymous = /知情人士|消息人士|网传|爆料|据悉|传闻/i.test(text);
  const informationGain = Math.max(10, Math.min(100,
    42 + specifics * 9
    + (/发布|推出|上线|开源|签署|收购|融资|降价|升级|通过|批准|起诉/i.test(text) ? 24 : 0)
    - (likelyRepost ? 18 : 0)
  ));
  const evidenceStrength = Math.max(10, Math.min(100,
    scoreBreakdown.sourceQuality
    + (specifics >= 2 ? 8 : 0)
    - (anonymous ? 24 : 0)
    - (likelyRepost ? 8 : 0)
  ));
  const breakdown: SelectionBreakdown = {
    informationGain,
    industryImpact: scoreBreakdown.industryImpact,
    evidenceStrength,
    specificity: Math.min(100, 28 + specifics * 18 + (summary.length >= 90 ? 18 : 0)),
    timeliness: scoreBreakdown.recency,
    userRelevance: 50,
  };
  const penalty = (likelyRepost ? 15 : 0) + (marketingRisk ? 20 : 0) + (informationGain < 42 ? 20 : 0);
  const score = Math.max(0, Math.min(100, Math.round(
    breakdown.informationGain * .25
    + breakdown.industryImpact * .25
    + breakdown.evidenceStrength * .2
    + breakdown.specificity * .1
    + breakdown.timeliness * .1
    + breakdown.userRelevance * .1
    - penalty
  )));
  const status: SelectionStatus = anonymous && evidenceStrength < 70
    ? "候选"
    : score >= 72
      ? "精选"
      : score >= 54
        ? "候选"
        : score >= 38
          ? "观察"
          : "淘汰";
  const coreChange = completeSentence(title);
  return {
    evidence: {
      hasNewFact: informationGain >= 58,
      coreChange,
      containsSpecifics: specifics > 0,
      evidenceStrength: evidenceStrength >= 80 ? "强" : evidenceStrength >= 60 ? "中" : "弱",
      likelyRepost,
      marketingRisk,
      uncertainty: anonymous
        ? "信息包含匿名或尚未公开确认的表述，需要等待官方或更多独立来源验证。"
        : "当前结论基于已抓取内容，后续执行结果和行业影响仍需持续观察。",
    },
    breakdown,
    score,
    status,
  };
};
const normalize = (title: string) => title.toLowerCase()
  .replace(/(?:最新|重磅|突发|官宣|独家|刚刚|正式宣布|正式发布|宣布推出)/g, "")
  .replace(/\b(?:announces?|launches?|releases?|unveils?|introduces?)\b/g, "")
  .replace(/\s*[-—_|]\s*[^-—_|]{1,30}$/g, "")
  .replace(/[^a-z0-9\u4e00-\u9fff]/g, "").slice(0, 54);
const eventTokens = (title: string) => [...new Set(
  title.toLowerCase().match(/[a-z][a-z0-9.-]{2,}|[\u4e00-\u9fff]{2,8}/g)
    ?.filter((token) => !/最新|重磅|正式|发布|推出|宣布|上线|开放|消息|报道|公司|科技/.test(token)) ?? []
)];
const entityList = (text: string) => [...new Set(
  text.match(/\b(?:OpenAI|Anthropic|DeepSeek|Google|Gemini|Claude|Meta|Microsoft|NVIDIA|AMD|Apple|Amazon|AWS|xAI|Mistral|Qwen|Llama|GPT)[\w.-]*\b|[\u4e00-\u9fff]{2,8}(?:公司|实验室|研究院|大学|模型|平台|芯片)/gi) ?? []
)].slice(0, 8);
const factList = (text: string) => [...new Set(
  text.match(/[^。！？.!?]*(?:\d+(?:\.\d+)?%?|20\d{2}年|\d+亿元|\d+亿美元|\d+[万亿]|正式发布|正式上线|开源)[^。！？.!?]*[。！？.!?]/g)
    ?.map((item) => item.trim()).filter((item) => item.length >= 12) ?? []
)].slice(0, 5);
const tokenSimilarity = (left: string[], right: string[]) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const intersection = left.filter((token) => rightSet.has(token)).length;
  return intersection / Math.max(left.length, right.length);
};

const memoryCache = new Map<string, { at: number; payload: unknown }>();
const sourceHealth = new Map<string, { lastSuccessAt: number; failures: number; attempts: number; successes: number }>();
const RECENT_SUCCESS_WINDOW = 6 * 60 * 60_000;

async function mapConcurrent<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchSource(source: Source, timeout = 5_500): Promise<SourceFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; AI-Brief/2.0; +https://ai-signal-brief-zhou.vercel.app)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(String(response.status));
    const xml = await response.text();
    const atom = source.type === "atom";
    const channelProfile = channelProfileFor(source);
    const blocks = xml.match(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) ?? [];
    const items = blocks.slice(0, 18).flatMap((block, index) => {
      const title = cleanTitle(field(block, "title"), source.name);
      const fullSummary = short(field(block, atom ? "summary" : "description") || field(block, "content:encoded"), 430);
      const publishedAt = decode(field(block, atom ? "published" : "pubDate") || field(block, "updated")) || new Date().toISOString();
      const baseTrust = channelProfile.channelTier === "T1" ? 90 : channelProfile.channelTier === "T1.5" ? 76 : 62;
      const imageUrl = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]+url=["']([^"']+)["']/i)?.[1]
        ?? block.match(/<img\b[^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1];
      return splitDigestTitle(title).map((focusedTitle, partIndex) => {
        const summary = focusedSummary(focusedTitle, fullSummary);
        const text = `${focusedTitle} ${summary}`;
        const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000);
        const evidence = (text.match(/\d+(?:\.\d+)?%?|20\d{2}年|\d+亿元|\d+亿美元|\d+[万亿]/g) ?? []).length;
        const scoreBreakdown: ScoreBreakdown = {
          sourceQuality: baseTrust,
          industryImpact: Math.min(100,
            38 + (/发布|推出|上线|开源|release|launch/i.test(text) ? 22 : 0)
            + (/成本|价格|融资|政策|监管|安全|芯片|算力|生态|竞争|部署/i.test(text) ? 22 : 0)
            + (/gpt|gemini|claude|deepseek|模型|智能体/i.test(text) ? 12 : 0)
          ),
          recency: ageHours <= 6 ? 100 : ageHours <= 24 ? 88 : ageHours <= 72 ? 68 : ageHours <= 168 ? 42 : 20,
          multiSource: 20,
          completeness: Math.min(100, 38 + Math.min(28, evidence * 8) + (summary.length >= 70 && summary.length <= 360 ? 28 : 8)),
          // The API has no user identity. The neutral value is replaced by a
          // topic-match contribution in the browser when the user has subscriptions.
          userRelevance: 50,
        };
        const score = Math.round(
          scoreBreakdown.sourceQuality * .25 + scoreBreakdown.industryImpact * .25
          + scoreBreakdown.recency * .15 + scoreBreakdown.multiSource * .15
          + scoreBreakdown.completeness * .1 + scoreBreakdown.userRelevance * .1
          - (/早报|晚报|日报|周报|月报|盘点|合集/.test(focusedTitle) ? 10 : 0)
          - (summary === focusedTitle ? 18 : 0)
        );
        const level: NewsItem["level"] = score >= 77 ? "重要" : score >= 58 ? "关注" : "一般";
        const category = categoryFor(text);
        const selection = selectionEvidenceFor(focusedTitle, summary, source, scoreBreakdown);
        return {
          id: `${source.mark}-${index}-${partIndex}-${publishedAt}`, title: focusedTitle, source: source.name, sourceMark: source.mark,
          publishedAt, url: linkFor(block, atom), category, level, score,
          trustScore: baseTrust, trustLabel: baseTrust >= 82 ? "高可信" : baseTrust >= 68 ? "较可信" : "待核实",
          summary, tags: [category, source.chinese ? "中文" : "国际"], related: 1, sourceMentions: [source.name], imageUrl,
          recommendationReasons: [], importanceReason: importanceFor(category, text),
          eventTitle: focusedTitle, eventKey: normalize(focusedTitle),
          entities: entityList(text), keyFacts: factList(summary),
          scoreBreakdown,
          uncertainty: "当前仅由单一来源提及，关键事实仍需等待更多独立来源验证。",
          trendKey: trendFor(category, text),
          selectionScore: selection.score,
          selectionStatus: selection.status,
          selectionEvidence: selection.evidence,
          selectionBreakdown: selection.breakdown,
          scoringVersion: SCORING_VERSION,
        } satisfies NewsItem;
      });
    }).filter((item) =>
      item.url
      && isQualityTitle(item.title, source.name)
      && isQualitySummary(item.summary, 18)
      && !hasEncodingGarbage(`${item.title}${item.summary}`)
      && (source.tier === 1 || isAi(`${item.title} ${item.summary}`))
    );
    return { items, rawItemCount: Math.min(18, blocks.length) };
  } finally { clearTimeout(timer); }
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requested = query.get("source");
  const disabled = new Set((query.get("disabled") ?? "").split("|").filter(Boolean));
  const cacheKey = requested ? `source:${requested}` : `disabled:${[...disabled].sort().join("|")}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 15 * 60_000) {
    return NextResponse.json(cached.payload, { headers: {
      "X-AI-Brief-Cache": "HIT",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    } });
  }
  const visibleSources = requested ? sources.filter((source) => source.name === requested) : sources;
  const active = visibleSources.filter((source) => !disabled.has(source.name)).sort((a, b) => a.tier - b.tier);
  if (!active.length && requested) return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  // Keep the first payload fast: failed sources retry on the next refresh rather than
  // extending the current request beyond the page's loading budget.
  const results = await mapConcurrent(active, 120, (source) => fetchSource(source, 3_200));
  const groups = new Map<string, NewsItem>();
  const tokenIndex = new Map<string, Set<string>>();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.items.forEach((item) => {
      const exactKey = normalize(item.title);
      const tokens = eventTokens(item.title);
      const candidates = [...new Set(tokens.flatMap((token) => [...(tokenIndex.get(token) ?? [])]))];
      const similarKey = candidates.find((candidateKey) => {
        const candidate = groups.get(candidateKey);
        if (!candidate) return false;
        const hours = Math.abs(new Date(candidate.publishedAt).getTime() - new Date(item.publishedAt).getTime()) / 3_600_000;
        return hours <= 96 && tokenSimilarity(tokens, eventTokens(candidate.title)) >= .58;
      });
      const key = groups.has(exactKey) ? exactKey : similarKey ?? exactKey;
      const existing = groups.get(key);
      if (existing) {
        existing.related += 1;
        existing.sourceMentions = [...new Set([...existing.sourceMentions, item.source])];
        existing.trustScore = Math.min(99, Math.max(existing.trustScore, item.trustScore) + Math.min(9, existing.related * 2));
        existing.trustLabel = existing.trustScore >= 82 ? "高可信" : existing.trustScore >= 68 ? "较可信" : "待核实";
        existing.scoreBreakdown.multiSource = Math.min(100, 20 + existing.related * 18);
        existing.score = Math.round(
          existing.scoreBreakdown.sourceQuality * .25 + existing.scoreBreakdown.industryImpact * .25
          + existing.scoreBreakdown.recency * .15 + existing.scoreBreakdown.multiSource * .15
          + existing.scoreBreakdown.completeness * .1 + existing.scoreBreakdown.userRelevance * .1
        );
        existing.level = existing.score >= 77 ? "重要" : existing.score >= 58 ? "关注" : "一般";
        existing.entities = [...new Set([...existing.entities, ...item.entities])].slice(0, 8);
        existing.keyFacts = [...new Set([...existing.keyFacts, ...item.keyFacts])].slice(0, 6);
        existing.selectionBreakdown.evidenceStrength = Math.min(100, existing.selectionBreakdown.evidenceStrength + 8);
        existing.selectionScore = Math.min(100, Math.round(
          existing.selectionBreakdown.informationGain * .25
          + existing.selectionBreakdown.industryImpact * .25
          + existing.selectionBreakdown.evidenceStrength * .2
          + existing.selectionBreakdown.specificity * .1
          + existing.selectionBreakdown.timeliness * .1
          + existing.selectionBreakdown.userRelevance * .1
          + Math.min(10, (existing.related - 1) * 3)
        ));
        existing.selectionStatus = existing.related >= 3 && existing.selectionScore >= 68
          ? "精选"
          : existing.selectionScore >= 54 ? "候选" : "观察";
        existing.selectionEvidence.evidenceStrength = existing.related >= 3 ? "强" : "中";
        existing.uncertainty = existing.related >= 3
          ? "该事件已获得多个独立来源印证，但后续影响和执行结果仍需持续观察。"
          : "已有不同来源提及该事件，关键细节仍需进一步交叉验证。";
      } else {
        item.eventKey = key;
        groups.set(key, item);
        tokens.forEach((token) => {
          const indexed = tokenIndex.get(token) ?? new Set<string>();
          indexed.add(key);
          tokenIndex.set(token, indexed);
        });
      }
    });
  });
  const items = [...groups.values()].filter((item) => item.selectionStatus !== "淘汰").sort((a, b) =>
    (b.selectionScore + b.related * 3) - (a.selectionScore + a.related * 3)
    || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  ).slice(0, 420).map((item) => {
    const ageHours = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 3_600_000);
    const reasons = [
      ...(item.related >= 3 ? [`${item.related} 个独立来源交叉提及`] : []),
      ...(item.trustScore >= 82 ? ["一手或高质量来源"] : []),
      ...(item.score >= 84 ? ["行业影响评分较高"] : []),
      ...(ageHours <= 24 ? ["24 小时内发布"] : []),
    ];
    item.recommendationReasons = [...new Set(reasons)].slice(0, 3);
    return item;
  });
  const statuses = visibleSources.map((source) => {
    const index = active.findIndex((item) => item.name === source.name);
    const enabled = index >= 0;
    const result = enabled ? results[index] : undefined;
    const succeeded = result?.status === "fulfilled";
    const previous = sourceHealth.get(source.name);
    if (succeeded) sourceHealth.set(source.name, {
      lastSuccessAt: Date.now(), failures: 0,
      attempts: (previous?.attempts ?? 0) + 1, successes: (previous?.successes ?? 0) + 1,
    });
    else if (enabled) sourceHealth.set(source.name, {
      lastSuccessAt: previous?.lastSuccessAt ?? 0, failures: (previous?.failures ?? 0) + 1,
      attempts: (previous?.attempts ?? 0) + 1, successes: previous?.successes ?? 0,
    });
    const recentlyHealthy = Boolean(previous?.lastSuccessAt && Date.now() - previous.lastSuccessAt < RECENT_SUCCESS_WINDOW);
    const health = !enabled ? "disabled" : succeeded ? "online" : recentlyHealthy ? "degraded" : "offline";
    const failures = succeeded ? 0 : (previous?.failures ?? 0) + (enabled ? 1 : 0);
    const channelProfile = channelProfileFor(source);
    const baseQuality = channelProfile.channelTier === "T1" ? 90 : channelProfile.channelTier === "T1.5" ? 76 : 62;
    const itemCount = result?.status === "fulfilled" ? result.value.items.length : 0;
    const rawItemCount = result?.status === "fulfilled" ? result.value.rawItemCount : 0;
    const currentHistory = sourceHealth.get(source.name);
    const successRate = currentHistory?.attempts ? Math.round(currentHistory.successes / currentHistory.attempts * 100) : 0;
    const sourceEvents = items.filter((item) => item.sourceMentions.includes(source.name));
    const multiSourceRate = sourceEvents.length
      ? Math.round(sourceEvents.filter((item) => item.related >= 2).length / sourceEvents.length * 100) : 0;
    const noiseRate = rawItemCount ? Math.round(Math.max(0, rawItemCount - itemCount) / rawItemCount * 100) : 100;
    const completenessRate = rawItemCount ? Math.round(itemCount / rawItemCount * 100) : 0;
    const signalDensity = rawItemCount ? Math.round(itemCount / rawItemCount * 100) : 0;
    const firstReportContribution = sourceEvents.length
      ? Math.round(sourceEvents.filter((item) => item.source === source.name).length / sourceEvents.length * 100)
      : 0;
    const averageDiscoveryLatencyMinutes = sourceEvents.length
      ? Math.round(sourceEvents.reduce((sum, item) => sum + Math.max(0, Date.now() - new Date(item.publishedAt).getTime()) / 60_000, 0) / sourceEvents.length)
      : 0;
    const recencyHealth = succeeded ? 100 : health === "degraded" ? 58 : 15;
    const qualityScore = Math.max(20, Math.min(98, Math.round(
      baseQuality * .35
      + successRate * .2
      + completenessRate * .15
      + multiSourceRate * .15
      + recencyHealth * .15
      - Math.min(16, failures * 3)
    )));
    return {
      name: source.name, mark: source.mark, homepage: source.homepage ?? new URL(source.url).origin, type: source.type ?? "rss",
      chinese: Boolean(source.chinese), trustScore: baseQuality, enabled,
      ok: health === "online" || health === "degraded", health,
      itemCount, rawItemCount, successRate, multiSourceRate, noiseRate,
      recentValidItems: sourceEvents.filter((item) => Date.now() - new Date(item.publishedAt).getTime() <= 30 * 86_400_000).length,
      sourceTier: source.tier, sourceClass: sourceClassFor(source),
      channelTier: channelProfile.channelTier,
      acquisitionMethod: channelProfile.acquisitionMethod,
      monitoringScope: channelProfile.monitoringScope,
      signalDensity, firstReportContribution, averageDiscoveryLatencyMinutes,
      validItemCost: channelProfile.acquisitionMethod === "第三方接口" ? 1.8 : channelProfile.acquisitionMethod === "HTML" ? .35 : .08,
      lastManualReviewAt: "2026-07-30",
      qualityLevel: qualityScore >= 82 ? "优先" : qualityScore >= 65 ? "正常" : qualityScore >= 48 ? "观察" : "建议停用",
      recommendation: qualityScore < 48 || failures >= 3 ? "建议暂停并检查来源" : qualityScore < 65 ? "降低排序权重" : "保持当前权重",
      completenessRate,
      lastCheckedAt: new Date().toISOString(),
      lastSuccessAt: currentHistory?.lastSuccessAt ? new Date(currentHistory.lastSuccessAt).toISOString() : "",
    };
  });
  const payload = {
    items, sources: statuses, updatedAt: new Date().toISOString(),
    healthySources: statuses.filter((item) => item.ok).length, totalSources: statuses.length,
    selectionStats: {
      selected: items.filter((item) => item.selectionStatus === "精选").length,
      candidate: items.filter((item) => item.selectionStatus === "候选").length,
      observing: items.filter((item) => item.selectionStatus === "观察").length,
      scoringVersion: SCORING_VERSION,
    },
  };
  if (items.length) {
    memoryCache.set(cacheKey, { at: Date.now(), payload });
    if (memoryCache.size > 20) memoryCache.delete(memoryCache.keys().next().value ?? "");
  }
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" } });
}
