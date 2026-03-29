/**
 * 获取头像显示的字符
 * 如果名字以"小"开头，显示"小"后面的那个字
 * 否则显示第一个字符
 */
export function getAvatarChar(name: string): string {
  if (!name) return ''

  // 如果名字以"小"开头且长度大于1，返回第二个字符
  if (name.startsWith('小') && name.length > 1) {
    return name.charAt(1)
  }

  // 否则返回第一个字符
  return name.charAt(0)
}
