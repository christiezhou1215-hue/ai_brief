import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Source = { name: string; mark: string; url: string; homepage?: string; type?: "rss" | "atom"; tier: 1 | 2 | 3; chinese?: boolean };
export type NewsItem = {
  id: string; title: string; source: string; sourceMark: string; publishedAt: string; url: string;
  category: string; level: "重要" | "关注" | "一般"; score: number; trustScore: number;
  trustLabel: "高可信" | "较可信" | "待核实"; summary: string; tags: string[];
  related: number; sourceMentions: string[]; imageUrl?: string;
};

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
const short = (value: string, max = 150) => {
  const text = decode(value)
    .replace(/^[·•\-–—\s]+/, "")
    .replace(/(?:\.{3,}|…{2,})/g, "。")
    .replace(/#\S+/g, "")
    .replace(/欢迎关注[\s\S]*$/i, "")
    .replace(/(?:微信公众号|微信号|更多精彩内容)[\s\S]*$/i, "")
    .replace(/\s+/g, " ").trim();
  if (!text) return "这条资讯提供了新的 AI 行业动态，点击可查看完整原文。";
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]/g)?.map((item) => item.trim()).filter((item) => item.length >= 12) ?? [];
  const selected = sentences.slice(0, 2).join("");
  if (selected && selected.length <= max + 30) return selected;
  const candidate = selected || text;
  if (candidate.length <= max) return completeSentence(candidate);
  const cut = candidate.slice(0, max);
  const boundary = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("！"), cut.lastIndexOf("？"), cut.lastIndexOf("；"), cut.lastIndexOf("，"));
  return completeSentence(cut.slice(0, boundary >= 55 ? boundary : max).replace(/[，；、\s]+$/, "").replace(/\s*(?:\.{3,}|…+)\s*$/, ""));
};
const cleanTitle = (value: string, sourceName = "") => {
  let text = decode(value).replace(/(?:\.{3,}|…+)/g, " ").replace(/\s+/g, " ").trim();
  const aliases = sourceName ? [
    sourceName,
    sourceName.replace(/\s*(?:科技|新闻|中文|AI|人工智能|开发者社区|开发者|研究院|实验室|学院)$/i, ""),
  ].filter((name) => name.length >= 2) : [];
  aliases.forEach((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\s*(?:[-—–_|｜]|·)\\s*${escaped}\\s*$`, "i"), "").trim();
  });
  text = text
    .replace(/\s*(?:[-—–_|｜]|·)\s*(?:阿里云开发者社区|腾讯云开发者社区|华为云开发者联盟|CSDN博客|掘金|光明网|新华网|人民网|中国新闻网|央视网|新浪科技|搜狐科技|网易科技|凤凰科技|澎湃新闻|极客公园|品玩|量子位|机器之心|雷峰网)\s*$/i, "")
    .replace(/\s*(?:[-—–_|｜]|·)\s*(?:www\.)?[\w.-]+\.(?:com|cn|net|org)(?:\.cn)?\s*$/i, "")
    .trim();
  if (text.length > 65 && (text.match(/[\/｜|]/g)?.length ?? 0) >= 2) {
    return text.split(/[\/]/)[0].trim();
  }
  return text;
};
const isAi = (text: string) => /人工智能|大模型|模型|智能体|机器人|算法|芯片|\bai\b|gpt|claude|gemini|deepseek|llm|agent/i.test(text);
const categoryFor = (text: string) => /agent|智能体|copilot/i.test(text) ? "AI Agent"
  : /code|coding|developer|编程|开发者/i.test(text) ? "AI 编程"
  : /image|video|multimodal|多模态|视频|图像|语音/i.test(text) ? "多模态"
  : /open.?source|开源|github/i.test(text) ? "开源项目"
  : /paper|research|benchmark|arxiv|研究|论文/i.test(text) ? "学术研究"
  : /model|gpt|gemini|claude|模型/i.test(text) ? "模型发布" : "行业动态";
const normalize = (title: string) => title.toLowerCase()
  .replace(/(?:最新|重磅|突发|官宣|独家|刚刚)/g, "").replace(/\s*[-—_|]\s*[^-—_|]{1,30}$/g, "")
  .replace(/[^a-z0-9\u4e00-\u9fff]/g, "").slice(0, 54);

const memoryCache = new Map<string, { at: number; payload: unknown }>();
const sourceHealth = new Map<string, { lastSuccessAt: number; failures: number }>();
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

async function fetchSource(source: Source, timeout = 5_500): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; AI-Brief/2.0; +https://ai-brief-drab.vercel.app)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(String(response.status));
    const xml = await response.text();
    const atom = source.type === "atom";
    const blocks = xml.match(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) ?? [];
    return blocks.slice(0, 18).map((block, index) => {
      const title = cleanTitle(field(block, "title"), source.name);
      const summary = short(field(block, atom ? "summary" : "description") || field(block, "content:encoded"));
      const text = `${title} ${summary}`;
      const publishedAt = decode(field(block, atom ? "published" : "pubDate") || field(block, "updated")) || new Date().toISOString();
      const baseTrust = source.tier === 1 ? 88 : source.tier === 2 ? 74 : 61;
      const score = Math.min(100, baseTrust - 20 + (/发布|推出|上线|开源|release|launch/i.test(text) ? 18 : 0) + (/gpt|gemini|claude|deepseek|模型/i.test(text) ? 11 : 0));
      const level: NewsItem["level"] = score >= 77 ? "重要" : score >= 58 ? "关注" : "一般";
      const imageUrl = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]+url=["']([^"']+)["']/i)?.[1]
        ?? block.match(/<img\b[^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1];
      return {
        id: `${source.mark}-${index}-${publishedAt}`, title, source: source.name, sourceMark: source.mark,
        publishedAt, url: linkFor(block, atom), category: categoryFor(text), level, score,
        trustScore: baseTrust, trustLabel: baseTrust >= 82 ? "高可信" : baseTrust >= 68 ? "较可信" : "待核实",
        summary, tags: [categoryFor(text), source.chinese ? "中文" : "国际"], related: 1, sourceMentions: [source.name], imageUrl,
      } satisfies NewsItem;
    }).filter((item) => item.title && item.url && (source.tier === 1 || isAi(`${item.title} ${item.summary}`)));
  } finally { clearTimeout(timer); }
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requested = query.get("source");
  const disabled = new Set((query.get("disabled") ?? "").split("|").filter(Boolean));
  const cacheKey = requested ? `source:${requested}` : `disabled:${[...disabled].sort().join("|")}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 15 * 60_000) {
    return NextResponse.json(cached.payload, { headers: { "X-AI-Brief-Cache": "HIT" } });
  }
  const visibleSources = requested ? sources.filter((source) => source.name === requested) : sources;
  const active = visibleSources.filter((source) => !disabled.has(source.name));
  if (!active.length && requested) return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  const results = await mapConcurrent(active, 48, (source) => fetchSource(source));
  const failedIndexes = results.map((result, index) => result.status === "rejected" ? index : -1).filter((index) => index >= 0);
  if (failedIndexes.length) {
    const retries = await mapConcurrent(failedIndexes, 32, (index) => fetchSource(active[index], 4_500));
    retries.forEach((result, retryIndex) => {
      if (result.status === "fulfilled") results[failedIndexes[retryIndex]] = result;
    });
  }
  const groups = new Map<string, NewsItem>();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((item) => {
      const key = normalize(item.title);
      const existing = groups.get(key);
      if (existing) {
        existing.related += 1;
        existing.sourceMentions = [...new Set([...existing.sourceMentions, item.source])];
        existing.trustScore = Math.min(99, Math.max(existing.trustScore, item.trustScore) + Math.min(9, existing.related * 2));
        existing.trustLabel = existing.trustScore >= 82 ? "高可信" : existing.trustScore >= 68 ? "较可信" : "待核实";
      } else groups.set(key, item);
    });
  });
  const items = [...groups.values()].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 420);
  const statuses = visibleSources.map((source) => {
    const index = active.findIndex((item) => item.name === source.name);
    const enabled = index >= 0;
    const result = enabled ? results[index] : undefined;
    const succeeded = result?.status === "fulfilled";
    const previous = sourceHealth.get(source.name);
    if (succeeded) sourceHealth.set(source.name, { lastSuccessAt: Date.now(), failures: 0 });
    else if (enabled) sourceHealth.set(source.name, { lastSuccessAt: previous?.lastSuccessAt ?? 0, failures: (previous?.failures ?? 0) + 1 });
    const recentlyHealthy = Boolean(previous?.lastSuccessAt && Date.now() - previous.lastSuccessAt < RECENT_SUCCESS_WINDOW);
    const health = !enabled ? "disabled" : succeeded ? "online" : recentlyHealthy ? "degraded" : "offline";
    return {
      name: source.name, mark: source.mark, homepage: source.homepage ?? new URL(source.url).origin, type: source.type ?? "rss",
      chinese: Boolean(source.chinese), trustScore: source.tier === 1 ? 88 : source.tier === 2 ? 74 : 61, enabled,
      ok: health === "online" || health === "degraded", health,
      itemCount: result?.status === "fulfilled" ? result.value.length : 0,
    };
  });
  const payload = {
    items, sources: statuses, updatedAt: new Date().toISOString(),
    healthySources: statuses.filter((item) => item.ok).length, totalSources: statuses.length,
  };
  if (items.length) {
    memoryCache.set(cacheKey, { at: Date.now(), payload });
    if (memoryCache.size > 20) memoryCache.delete(memoryCache.keys().next().value ?? "");
  }
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" } });
}
