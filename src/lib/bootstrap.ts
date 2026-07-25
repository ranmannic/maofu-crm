import { prisma } from "@/lib/prisma";

const CHANNEL_TREE: { category: string; children: string[] }[] = [
  { category: "团购业务", children: ["团购客户", "高端烟酒店"] },
  {
    category: "批发业务",
    children: ["烟酒杂货店", "超市便利店", "礼品店", "村商店"],
  },
  { category: "直销业务", children: ["线上直销", "线下直销"] },
  { category: "分销业务", children: ["线上分销", "红白事渠道", "外部销售"] },
  { category: "特渠业务", children: ["内部渠道"] },
];

/** 初始化默认渠道分类（不含演示客户/订单数据） */
export async function seedDefaultChannels() {
  for (let i = 0; i < CHANNEL_TREE.length; i++) {
    const { category, children } = CHANNEL_TREE[i];

    const parent = await prisma.channelType.upsert({
      where: { name: category },
      update: { sortOrder: i, parentId: null },
      create: { name: category, sortOrder: i, parentId: null },
    });

    for (let j = 0; j < children.length; j++) {
      const childName = children[j];
      await prisma.channelType.upsert({
        where: { name: childName },
        update: { sortOrder: j, parentId: parent.id },
        create: {
          name: childName,
          sortOrder: j,
          parentId: parent.id,
        },
      });
    }
  }
}
