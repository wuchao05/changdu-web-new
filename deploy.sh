#!/bin/bash

# 长读工作台部署脚本

set -e

# 配置变量
APP_NAME="changdu-web"
APP_DIR="/home/web/changdu-web"
RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"

# 运行数据目录（项目外，永久保存）
DATA_DIR="/data/changdu-web"
STUDIO_DATA_DIR="$DATA_DIR/studio"
PM2_CONFIG_FILE="$DATA_DIR/ecosystem.config.js"

# 检查是否为本地部署
if [ "$1" = "local" ]; then
    echo "🚀 开始本地部署长读工作台..."
    
    # 检查Node.js和pnpm
    echo "📋 检查环境..."
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装，请先安装 Node.js >= 20"
        exit 1
    fi

    if ! command -v pnpm &> /dev/null; then
        echo "❌ pnpm 未安装，请先安装 pnpm"
        exit 1
    fi

    # 安装依赖
    echo "📦 安装依赖..."
    # 配置国内镜像源以提高下载速度
    echo "🔧 配置 npm 镜像源..."
    npm config set registry https://registry.npmmirror.com/
    pnpm config set registry https://registry.npmmirror.com/
    
    # 设置超时时间和重试次数
    pnpm config set network-timeout 300000
    pnpm config set fetch-retries 5
    pnpm config set fetch-retry-factor 2
    pnpm config set fetch-retry-mintimeout 10000
    pnpm config set fetch-retry-maxtimeout 60000
    
    echo "📦 开始安装依赖..."
    pnpm install

    # 代码格式化
    echo "✨ 格式化代码..."
    pnpm run format

    # 代码检查
    echo "🔍 检查代码..."
    pnpm run lint

    # 构建项目
    echo "🔨 构建项目..."
    pnpm run build

    if [ $? -eq 0 ]; then
        echo "✅ 构建成功！"
        echo "📁 构建文件位于 dist/ 目录"
        echo "🌐 可以将 dist/ 目录部署到静态文件服务器"
        echo ""
        echo "💡 本地预览："
        echo "   pnpm run preview"
        echo ""
        echo "🔧 配置提醒："
        echo "   1. 确保已配置 .env 文件"
        echo "   2. 在设置页面配置API请求头"
        echo "   3. 检查CORS设置"
    else
        echo "❌ 构建失败，请检查错误信息"
        exit 1
    fi
else
    echo "🚀 开始服务器部署 $APP_NAME..."
    echo "时间戳: $TIMESTAMP"

    # 1. 创建新版本目录
    mkdir -p "$RELEASE_DIR"
    cd "$RELEASE_DIR"

    # 2. 从GitHub下载最新代码
    echo "📥 下载代码..."
    if [ -n "$GITHUB_TOKEN" ]; then
        echo "使用Token认证..."
        git clone "https://${GITHUB_TOKEN}@github.com/wuchao05/changdu-web.git" .
    else
        echo "使用公开访问（如果是私有仓库，请设置GITHUB_TOKEN环境变量）..."
        git clone "https://github.com/wuchao05/changdu-web.git" .
    fi

    # 3. 安装依赖
    echo "📦 安装依赖..."
    # 配置国内镜像源以提高下载速度
    echo "🔧 配置 npm 镜像源..."
    npm config set registry https://registry.npmmirror.com/
    pnpm config set registry https://registry.npmmirror.com/
    
    # 设置超时时间和重试次数
    pnpm config set network-timeout 300000
    pnpm config set fetch-retries 5
    pnpm config set fetch-retry-factor 2
    pnpm config set fetch-retry-mintimeout 10000
    pnpm config set fetch-retry-maxtimeout 60000
    
    echo "📦 开始安装依赖..."
    pnpm install --frozen-lockfile

    # 4. 构建项目
    echo "🔨 构建项目..."
    pnpm run build

    # 初始化配置目录和文件
    echo "📋 初始化配置目录..."
    mkdir -p "$DATA_DIR" "$STUDIO_DATA_DIR"
    
    # 创建/更新 PM2 配置文件
    echo "🆕 创建 PM2 配置文件..."
    cat > "$PM2_CONFIG_FILE" << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    cwd: '$CURRENT_LINK',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      STUDIO_DATA_DIR: '$STUDIO_DATA_DIR',
      CHANGDU_REVERSE_DIR: '$DATA_DIR/reverse-bogus'
    }
  }]
}
EOF
    echo "✅ 已创建 $PM2_CONFIG_FILE"
    
    # 6. 复制共享文件
    echo "📋 复制共享文件..."
    if [ -f "$SHARED_DIR/.env" ]; then
        cp "$SHARED_DIR/.env" .
        echo "✅ 已复制共享 .env 文件"
    elif [ -f ".env" ]; then
        echo "✅ 使用项目根目录的 .env 文件"
    else
        echo "⚠️  警告: 未找到 .env 文件，请确保已配置环境变量"
        echo "   可以在服务器上创建 $SHARED_DIR/.env 文件"
    fi

    # 7. 停止旧服务
    echo "⏹️ 停止旧服务..."
    pm2 delete "$APP_NAME" 2>/dev/null || true

    # 8. 更新软链接
    echo "🔗 更新软链接..."
    ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

    # 9. 使用外部 PM2 配置启动新服务
    echo "▶️ 启动新服务（使用外部配置）..."
    echo "   配置文件: $PM2_CONFIG_FILE"
    echo "   Studio 数据目录: $STUDIO_DATA_DIR"
    pm2 start "$PM2_CONFIG_FILE"

    # 10. 保存PM2配置
    pm2 save

    # 11. 健康检查
    echo "🏥 健康检查..."
    sleep 5

    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ 健康检查通过！"
    else
        echo "❌ 健康检查失败，尝试重启服务..."
        pm2 restart "$APP_NAME"
        sleep 5
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            echo "✅ 重启后健康检查通过！"
        else
            echo "❌ 服务启动失败，请检查日志："
            pm2 logs "$APP_NAME" --lines 20
            exit 1
        fi
    fi

    # 13. 重载Nginx配置
    echo "🔄 重载Nginx配置..."
    sudo systemctl reload nginx 2>/dev/null || echo "⚠️  Nginx未运行或无权限重载"

    # 14. 清理旧版本（保留最近5个版本）
    echo "🧹 清理旧版本..."
    cd "$RELEASES_DIR"
    ls -t | tail -n +6 | xargs -r rm -rf

    echo ""
    echo "🎉 部署完成！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 当前版本: $TIMESTAMP"
    echo "📁 Studio 数据目录: $STUDIO_DATA_DIR"
    echo "⚙️  PM2 配置: $PM2_CONFIG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 服务状态:"
    pm2 status "$APP_NAME"
    echo ""
    echo "🌐 访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost')"
    echo ""
    echo "💡 提示："
    echo "   - Studio 数据目录位于: $DATA_DIR"
    echo "   - 目录中的用户与渠道数据不会被部署覆盖，永久保存"
    echo "   - 可通过网站设置页面管理配置"
fi
