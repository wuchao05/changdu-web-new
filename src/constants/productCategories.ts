export type PlayletGender = '1' | '2' | '3'

export interface ProductCategoryNode {
  id: string
  name: string
  children?: ProductCategoryNode[]
}

export interface ProductSelectionResult {
  firstCategoryId: string
  firstCategoryName: string
  subCategoryId: string
  subCategoryName: string
  thirdCategoryId: string
  thirdCategoryName: string
  playletGender: PlayletGender
}

export const PRODUCT_CATEGORY_TREE: ProductCategoryNode = {
  id: '2019',
  name: '短剧',
  children: [
    {
      id: '201901',
      name: '都市',
      children: [
        { id: '20190121', name: '神医' },
        { id: '20190122', name: '赘婿' },
        { id: '20190123', name: '鉴宝' },
        { id: '20190124', name: '战神' },
        { id: '20190125', name: '神豪' },
        { id: '20190126', name: '系统' },
        { id: '20190127', name: '校园' },
        { id: '20190128', name: '职场' },
        { id: '20190129', name: '官场' },
        { id: '20190130', name: '家庭' },
        { id: '20190131', name: '乡村' },
        { id: '20190132', name: '异能' },
        { id: '20190133', name: '其他' },
      ],
    },
    {
      id: '201902',
      name: '悬疑',
      children: [
        { id: '20190204', name: '灵异' },
        { id: '20190205', name: '悬疑推理' },
        { id: '20190206', name: '其他' },
      ],
    },
    {
      id: '201903',
      name: '现言',
      children: [
        { id: '20190309', name: '虐恋' },
        { id: '20190310', name: '甜宠' },
        { id: '20190311', name: '萌宝' },
        { id: '20190312', name: '总裁' },
        { id: '20190313', name: '腹黑' },
        { id: '20190314', name: '替身' },
        { id: '20190315', name: '娱乐明星' },
        { id: '20190316', name: '其他' },
      ],
    },
    {
      id: '201904',
      name: '古言',
      children: [
        { id: '20190408', name: '宫斗宅斗' },
        { id: '20190409', name: '种田经商' },
        { id: '20190410', name: '穿越' },
        { id: '20190411', name: '战争' },
        { id: '20190412', name: '其他' },
      ],
    },
    {
      id: '201905',
      name: '军事',
      children: [
        { id: '20190504', name: '穿越战争' },
        { id: '20190505', name: '现代军事' },
        { id: '20190506', name: '其他' },
      ],
    },
    {
      id: '201906',
      name: '玄幻',
      children: [
        { id: '20190605', name: '奇幻仙侠' },
        { id: '20190606', name: '科幻脑洞' },
        { id: '20190607', name: '架空玄幻' },
        { id: '20190608', name: '其他' },
      ],
    },
    {
      id: '201912',
      name: '其他剧情',
      children: [{ id: '20191201', name: '其他' }],
    },
  ],
}
