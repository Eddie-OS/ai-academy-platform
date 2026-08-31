/**
 * 60 人人物名录 —— 全平台模拟数据里所有出场人物的唯一出处。
 *
 * <h3>为什么要有这么一份东西</h3>
 *
 * 姓名此前散在六份 fixture 里各写一遍（讲师池写「李玥」，需求表也写「李玥」，
 * 两处能对上纯属巧合）。头像接进来之后这件事就不再是巧合问题了：
 * <b>同一个人在五个驾驶舱里必须是同一张脸</b>，否则运营会以为是两个人。
 * 名录集中一份，姓名、性别、头像、部门四者绑定，任何一页想画人就从这里查。
 *
 * <h3>工号与后端造数一一对应</h3>
 *
 * 下标 + 1 就是工号尾号：第 1 条是 {@code E0001}。这与 {@code scripts/seed/seed.sql}
 * 的 {@code generate_series} 同序 —— 后端造数按工号取名字，前端按工号取头像，
 * 两边不会各自漂。改名录必须同步改 seed.sql 的 {@code EMPLOYEE_NAMES}，
 * {@code people.seedParity.test.ts} 会断言两边同序同值。
 *
 * <h3>头像是打散绑定的，不是顺序对应</h3>
 *
 * {@code avatar} 显式写在每条上，male_01～30 与 female_01～30 各用满一次、不重复。
 * 顺序刻意打散（E0002 拿的是 male_07 不是 male_01）—— 按工号顺序对应会让
 * 讲师池头两排出现同一批相似构图，看起来像占位图没换。
 *
 * <p><b>不要改成按姓名散列取图。</b>散列会碰撞，60 人里必然出现两个人同一张脸，
 * 而这正是名录要消除的那个问题。
 *
 * <h3>部门是自由文本，不是组织架构</h3>
 *
 * 八个部门取消费电子公司的实际条线。禁区第 12 项（N18）删掉了组织架构表与部门树，
 * 所以这里只是 {@code org_employee.dept_name} 的字符串取值，不参与任何统计维度。
 * 部门与「所属领域」是两件事：领域七类（现场口径 D-21）由各驾驶舱的对象自己挂，
 * 与这个人在哪个部门无关 —— 市场营销部的人也可以讲零售领域的课。
 */

export type Gender = 'male' | 'female';

export interface PersonRecord {
  /** 工号。下标 + 1，与 seed.sql 同序 */
  no: string;
  name: string;
  gender: Gender;
  /** 头像文件名（不含目录与扩展名），male_01～30 / female_01～30 各用一次 */
  avatar: string;
  /** 所属部门。自由文本（N18），仅用于展示与筛选 */
  dept: string;
  /** 岗位。不是账号角色 —— 一期只有两个共享账号，没有角色表（禁区第 11 项） */
  position: string;
}

/** 八个部门。消费电子公司的实际条线，与领域七类不是一套东西 */
export const DEPARTMENTS = [
  '市场营销部',
  '客户服务部',
  '零售运营部',
  'GTM策略部',
  '电商运营部',
  '渠道管理部',
  '政企客户部',
  '数据合规部',
] as const;

/**
 * 名录本体。
 *
 * <p>前 16 人是 {@code seed-demo.sql} 里做负责人与提出人的那一批
 * （{@code 1 + ((n - 1) % 16)}），因此这一段放的是各驾驶舱已经出场的熟脸，
 * 改动它们的姓名会让六份 fixture 里的引用一起失效。
 *
 * <p>E0005／E0010／E0015…（工号尾号能被 5 整除）在造数里是<b>离职</b>状态，
 * 「离职负责人警告」与「离职人员不可新选为讲师」两条规则靠它们才走得到。
 * 这几个位置刻意不放核心讲师。
 */
export const PEOPLE: PersonRecord[] = [
  { no: 'E0001', name: '李玥', gender: 'female', avatar: 'female_14', dept: '市场营销部', position: '高级培训经理' },
  { no: 'E0002', name: '王宇', gender: 'male', avatar: 'male_07', dept: '客户服务部', position: '服务运营专家' },
  { no: 'E0003', name: '张伟', gender: 'male', avatar: 'male_19', dept: '零售运营部', position: '零售业务顾问' },
  { no: 'E0004', name: '陈晨', gender: 'female', avatar: 'female_02', dept: 'GTM策略部', position: 'GTM策略经理' },
  { no: 'E0005', name: '徐涛', gender: 'male', avatar: 'male_03', dept: '电商运营部', position: '电商运营主管' },
  { no: 'E0006', name: '周建', gender: 'male', avatar: 'male_26', dept: '渠道管理部', position: '渠道赋能经理' },
  { no: 'E0007', name: '黄悦', gender: 'female', avatar: 'female_25', dept: '政企客户部', position: '政企解决方案顾问' },
  { no: 'E0008', name: '吴迪', gender: 'male', avatar: 'male_11', dept: '数据合规部', position: '数据合规专员' },
  { no: 'E0009', name: '刘洋', gender: 'male', avatar: 'male_30', dept: '市场营销部', position: '品牌营销经理' },
  { no: 'E0010', name: '胡军', gender: 'male', avatar: 'male_15', dept: '客户服务部', position: '客服培训主管' },
  { no: 'E0011', name: '王芳', gender: 'female', avatar: 'female_09', dept: '零售运营部', position: '门店运营经理' },
  { no: 'E0012', name: '李明', gender: 'male', avatar: 'male_01', dept: 'GTM策略部', position: '上市推广经理' },
  { no: 'E0013', name: '陈华', gender: 'male', avatar: 'male_22', dept: '电商运营部', position: '电商产品经理' },
  { no: 'E0014', name: '赵敏', gender: 'female', avatar: 'female_18', dept: '渠道管理部', position: '渠道培训专员' },
  { no: 'E0015', name: '朱斌', gender: 'male', avatar: 'male_08', dept: '政企客户部', position: '政企客户经理' },
  { no: 'E0016', name: '周强', gender: 'male', avatar: 'male_27', dept: '数据合规部', position: '合规审计经理' },
  { no: 'E0017', name: '孙悦', gender: 'female', avatar: 'female_05', dept: '市场营销部', position: '内容营销专员' },
  { no: 'E0018', name: '张小北', gender: 'male', avatar: 'male_04', dept: '客户服务部', position: '平台管理员' },
  { no: 'E0019', name: '李华', gender: 'male', avatar: 'male_17', dept: '零售运营部', position: '零售培训经理' },
  { no: 'E0020', name: '高翔', gender: 'male', avatar: 'male_12', dept: 'GTM策略部', position: '产品上市专员' },
  { no: 'E0021', name: '张婧', gender: 'female', avatar: 'female_29', dept: '电商运营部', position: '直播运营经理' },
  { no: 'E0022', name: '林锋', gender: 'male', avatar: 'male_29', dept: '渠道管理部', position: '经销商管理专员' },
  { no: 'E0023', name: '刘敏', gender: 'female', avatar: 'female_21', dept: '政企客户部', position: '投标支持专员' },
  { no: 'E0024', name: '何勇', gender: 'male', avatar: 'male_06', dept: '数据合规部', position: '隐私保护工程师' },
  { no: 'E0025', name: '陈曦', gender: 'female', avatar: 'female_11', dept: '市场营销部', position: '营销数据分析师' },
  { no: 'E0026', name: '郭峰', gender: 'male', avatar: 'male_23', dept: '客户服务部', position: '售后服务经理' },
  { no: 'E0027', name: '周雯', gender: 'female', avatar: 'female_27', dept: '零售运营部', position: '导购培训专员' },
  { no: 'E0028', name: '马超', gender: 'male', avatar: 'male_10', dept: 'GTM策略部', position: '竞品分析师' },
  { no: 'E0029', name: '吴悦', gender: 'female', avatar: 'female_03', dept: '电商运营部', position: '平台店铺运营' },
  { no: 'E0030', name: '罗宇', gender: 'male', avatar: 'male_20', dept: '渠道管理部', position: '渠道政策专员' },
  { no: 'E0031', name: '赵璐', gender: 'female', avatar: 'female_16', dept: '政企客户部', position: '行业方案经理' },
  { no: 'E0032', name: '梁毅', gender: 'male', avatar: 'male_02', dept: '数据合规部', position: '数据治理专员' },
  { no: 'E0033', name: '孙倩', gender: 'female', avatar: 'female_08', dept: '市场营销部', position: '活动策划经理' },
  { no: 'E0034', name: '宋涛', gender: 'male', avatar: 'male_25', dept: '客户服务部', position: '服务质量专员' },
  { no: 'E0035', name: '徐婕', gender: 'female', avatar: 'female_30', dept: '零售运营部', position: '零售陈列顾问' },
  { no: 'E0036', name: '唐睿', gender: 'male', avatar: 'male_14', dept: 'GTM策略部', position: '定价策略分析师' },
  { no: 'E0037', name: '朱琳', gender: 'female', avatar: 'female_13', dept: '电商运营部', position: '会员运营经理' },
  { no: 'E0038', name: '许铭', gender: 'male', avatar: 'male_09', dept: '渠道管理部', position: '渠道拓展经理' },
  { no: 'E0039', name: '高萌', gender: 'female', avatar: 'female_24', dept: '政企客户部', position: '政企运营专员' },
  { no: 'E0040', name: '韩烨', gender: 'male', avatar: 'male_28', dept: '数据合规部', position: '合规培训讲师' },
  { no: 'E0041', name: '林娜', gender: 'female', avatar: 'female_06', dept: '市场营销部', position: '社媒运营专员' },
  { no: 'E0042', name: '冯凯', gender: 'male', avatar: 'male_16', dept: '客户服务部', position: '呼叫中心主管' },
  { no: 'E0043', name: '何静', gender: 'female', avatar: 'female_19', dept: '零售运营部', position: '店效分析师' },
  { no: 'E0044', name: '董浩', gender: 'male', avatar: 'male_05', dept: 'GTM策略部', position: '新品导入经理' },
  { no: 'E0045', name: '郭蕊', gender: 'female', avatar: 'female_01', dept: '电商运营部', position: '电商内容专员' },
  { no: 'E0046', name: '程斌', gender: 'male', avatar: 'male_21', dept: '渠道管理部', position: '渠道数据分析师' },
  { no: 'E0047', name: '马蕾', gender: 'female', avatar: 'female_26', dept: '政企客户部', position: '客户成功经理' },
  { no: 'E0048', name: '曹阳', gender: 'male', avatar: 'male_13', dept: '数据合规部', position: '安全合规顾问' },
  { no: 'E0049', name: '罗欣', gender: 'female', avatar: 'female_10', dept: '市场营销部', position: '品牌公关专员' },
  { no: 'E0050', name: '袁通', gender: 'male', avatar: 'male_24', dept: '客户服务部', position: '维修网络经理' },
  { no: 'E0051', name: '梁颖', gender: 'female', avatar: 'female_22', dept: '零售运营部', position: '零售人才发展' },
  { no: 'E0052', name: '蒋成', gender: 'male', avatar: 'male_18', dept: 'GTM策略部', position: '市场情报专员' },
  { no: 'E0053', name: '宋佳', gender: 'female', avatar: 'female_04', dept: '电商运营部', position: '大促运营经理' },
  { no: 'E0054', name: '唐雨', gender: 'female', avatar: 'female_28', dept: '渠道管理部', position: '渠道激励专员' },
  { no: 'E0055', name: '许晴', gender: 'female', avatar: 'female_15', dept: '政企客户部', position: '标案文档专员' },
  { no: 'E0056', name: '韩雪', gender: 'female', avatar: 'female_07', dept: '数据合规部', position: '跨境合规专员' },
  { no: 'E0057', name: '冯瑶', gender: 'female', avatar: 'female_20', dept: '市场营销部', position: '用户研究员' },
  { no: 'E0058', name: '董岚', gender: 'female', avatar: 'female_12', dept: '客户服务部', position: '服务体验设计师' },
  { no: 'E0059', name: '曹丹', gender: 'female', avatar: 'female_23', dept: '零售运营部', position: '区域培训主管' },
  { no: 'E0060', name: '袁琪', gender: 'female', avatar: 'female_17', dept: 'GTM策略部', position: '发布会项目经理' },
];

/** 姓名 → 名录条目。同名会取先出现的那条，名录里没有同名 */
const BY_NAME = new Map(PEOPLE.map((person) => [person.name, person]));

/** 工号 → 名录条目 */
const BY_NO = new Map(PEOPLE.map((person) => [person.no, person]));

export function personByName(name: string): PersonRecord | undefined {
  return BY_NAME.get(name);
}

export function personByNo(no: string): PersonRecord | undefined {
  return BY_NO.get(no);
}

/**
 * 姓名 → 头像 URL。名录里没这个人时返回 undefined，由 Avatar 回落到首字底色。
 *
 * <p>回落必须保留：模拟数据里还有「业务接口人」「学员甲」这类没有工号的角色，
 * 它们不该为了有张脸而被硬塞进人员台账。
 */
export function avatarUrlOf(name: string): string | undefined {
  const person = BY_NAME.get(name);
  return person ? `/assets/avatars/${person.avatar}.png` : undefined;
}
