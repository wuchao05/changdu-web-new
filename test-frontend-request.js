// 模拟前端请求 getFile 接口
const testPath = '/Volumes/爆爆盘/短剧剪辑/10.12导出/为他心动/10.12-为他心动-xh-03.mp4'

async function testFrontendRequest() {
  try {
    console.log('=== 模拟前端请求测试 ===')
    console.log('测试路径:', testPath)

    const encodedPath = encodeURIComponent(testPath)
    console.log('编码后路径:', encodedPath)

    // 模拟前端的相对路径请求
    const url = `/api/xt/getFile?path=${encodedPath}`
    console.log('前端请求URL:', url)

    // 使用绝对URL测试
    const absoluteUrl = `http://localhost:3000${url}`
    console.log('绝对URL:', absoluteUrl)

    console.log('\n=== 测试相对路径请求 ===')
    try {
      const relativeResponse = await fetch(url, {
        method: 'GET',
      })
      console.log('相对路径响应状态:', relativeResponse.status)
      console.log('相对路径响应头:', Object.fromEntries(relativeResponse.headers.entries()))

      if (relativeResponse.ok) {
        const blob = await relativeResponse.blob()
        console.log('相对路径获取到blob，大小:', blob.size)
      } else {
        const errorText = await relativeResponse.text()
        console.log('相对路径响应错误:', errorText)
      }
    } catch (relativeError) {
      console.log('相对路径请求失败:', relativeError.message)
    }

    console.log('\n=== 测试绝对路径请求 ===')
    try {
      const absoluteResponse = await fetch(absoluteUrl, {
        method: 'GET',
      })
      console.log('绝对路径响应状态:', absoluteResponse.status)
      console.log('绝对路径响应头:', Object.fromEntries(absoluteResponse.headers.entries()))

      if (absoluteResponse.ok) {
        const blob = await absoluteResponse.blob()
        console.log('绝对路径获取到blob，大小:', blob.size)
      } else {
        const errorText = await absoluteResponse.text()
        console.log('绝对路径响应错误:', errorText)
      }
    } catch (absoluteError) {
      console.log('绝对路径请求失败:', absoluteError.message)
    }
  } catch (error) {
    console.error('测试失败:', error)
  }
}

testFrontendRequest()
