// 題庫（之後可以擴充或分難度）
export const wordList = [
  // 動物
  '貓', '狗', '兔子', '大象', '長頸鹿', '獅子', '老虎', '企鵝', '鯊魚', '蝴蝶',
  '烏龜', '熊貓', '猴子', '鱷魚', '獨角獸',
  // 食物
  'pizza', '漢堡', '壽司', '冰淇淋', '蛋糕', '西瓜', '香蕉', '草莓', '拉麵', '珍珠奶茶',
  '薯條', '熱狗', '甜甜圈', '壽司', '章魚燒',
  // 交通工具
  '飛機', '火車', '腳踏車', '摩托車', '直升機', '潛水艇', '熱氣球', '獨木舟', '火箭', '滑板',
  // 日常物品
  '電話', '電腦', '眼鏡', '雨傘', '書包', '鬧鐘', '燈泡', '鑰匙', '剪刀', '牙刷',
  // 自然
  '彩虹', '閃電', '雪人', '仙人掌', '火山', '瀑布', '月亮', '星星', '雲', '樹',
  // 運動
  '足球', '籃球', '網球', '游泳', '溜冰', '滑雪',
]

export function getRandomWord() {
  return wordList[Math.floor(Math.random() * wordList.length)]
}

export function getRandomWords(count = 3) {
  const shuffled = [...wordList].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
