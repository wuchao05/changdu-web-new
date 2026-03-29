/**
 * 视频工具函数
 */

/**
 * 获取视频信息，包括宽、高、时长
 * @param file File对象
 * @returns Promise<{ duration: number; width: number; height: number }>
 */
export const getVideoInfo = (
  file: File
): Promise<{ duration: number; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    // 检查文件类型
    if (!file.type.startsWith('video/')) {
      reject(new Error('文件不是视频类型'))
      return
    }

    const videoElement = document.createElement('video')
    videoElement.preload = 'metadata'

    // 创建对象URL
    const objectURL = URL.createObjectURL(file)
    videoElement.src = objectURL

    // 监听元数据加载完成事件
    videoElement.addEventListener('loadedmetadata', function () {
      try {
        const videoInfo = {
          duration: Math.round(videoElement.duration * 100) / 100, // 保留两位小数
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        }

        // 释放URL对象，防止内存泄漏
        URL.revokeObjectURL(objectURL)

        resolve(videoInfo)
      } catch (error) {
        URL.revokeObjectURL(objectURL)
        reject(error)
      }
    })

    // 监听错误事件
    videoElement.addEventListener('error', function () {
      URL.revokeObjectURL(objectURL)
      reject(new Error('视频加载失败'))
    })

    // 设置超时，防止某些情况下事件不触发
    setTimeout(() => {
      URL.revokeObjectURL(objectURL)
      reject(new Error('获取视频信息超时'))
    }, 10000) // 10秒超时
  })
}

/**
 * 获取视频缩略图
 * @param file File对象
 * @param time 截取时间点（秒），默认为1秒
 * @returns Promise<string> 返回base64格式的图片
 */
export const getVideoThumbnail = (file: File, time: number = 1): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) {
      reject(new Error('文件不是视频类型'))
      return
    }

    const videoElement = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法创建canvas上下文'))
      return
    }

    const objectURL = URL.createObjectURL(file)
    videoElement.src = objectURL

    videoElement.addEventListener('loadedmetadata', function () {
      // 设置canvas尺寸为视频尺寸
      canvas.width = videoElement.videoWidth
      canvas.height = videoElement.videoHeight

      // 跳转到指定时间点
      videoElement.currentTime = Math.min(time, videoElement.duration)
    })

    videoElement.addEventListener('seeked', function () {
      try {
        // 在canvas上绘制视频帧
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

        // 转换为base64
        const thumbnail = canvas.toDataURL('image/jpeg', 0.8)

        // 释放URL对象
        URL.revokeObjectURL(objectURL)

        resolve(thumbnail)
      } catch (error) {
        URL.revokeObjectURL(objectURL)
        reject(error)
      }
    })

    videoElement.addEventListener('error', function () {
      URL.revokeObjectURL(objectURL)
      reject(new Error('视频加载失败'))
    })

    // 设置超时
    setTimeout(() => {
      URL.revokeObjectURL(objectURL)
      reject(new Error('获取视频缩略图超时'))
    }, 10000)
  })
}

/**
 * 格式化视频时长
 * @param duration 时长（秒）
 * @returns 格式化后的时长字符串，如 "01:23:45"
 */
export const formatDuration = (duration: number): string => {
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = Math.floor(duration % 60)

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串，如 "1.23 MB"
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
