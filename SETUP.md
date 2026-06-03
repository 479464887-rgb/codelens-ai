# CodeLens AI - 项目状态 & 下一步

## 已完成 ✅

| 项目 | 详情 |
|------|------|
| 扩展代码 | 15文件，Manifest V3，GitHub API + DeepSeek/Kimi |
| GitHub仓库 | https://github.com/479464887-rgb/codelens-ai |
| GitHub Token | `codelens-ai-dev`（public_repo，永久） |
| GitHub Pages | https://479464887-rgb.github.io/codelens-ai/ |
| 隐私政策 | privacy.html（Pages部署中） |
| 图标 | 16/48/128px，蓝底放大镜+尖括号 |
| API Key安全 | ask.js/search.js 已摘除硬编码key |
| 备忘录 | "CodeLens AI - GitHub Token"、"代理服务 - mihomo/clash" |

## 代理

```
# 启动
/tmp/mihomo -d ~/Library/Application\ Support/io.github.clash-verge-rev.clash-verge-rev \
  -f ~/Library/Application\ Support/io.github.clash-verge-rev.clash-verge-rev/config.yaml &

# 需要翻墙时
networksetup -setwebproxy Wi-Fi 127.0.0.1 7897
networksetup -setsecurewebproxy Wi-Fi 127.0.0.1 7897

# 关代理
networksetup -setwebproxystate Wi-Fi off
networksetup -setsecurewebproxystate Wi-Fi off
```

## 待做

### Chrome 开发者注册（$5）
1. 开代理
2. Chrome 打开 https://chrome.google.com/webstore/devconsole/register
3. Google登录：479464887@qq.com
4. 支付 $5 注册费
5. 关代理

### 扩展测试
1. Chrome → chrome://extensions → 开发者模式
2. 加载已解压的扩展 → 选择 codelens-ai 目录
3. 打开 GitHub PR 页面测试
4. Settings里填 DeepSeek API Key：sk-3d248dabf05f4837ab3ec3577df95ce0

### ExtensionPay（发布前）
注册账号 + Stripe关联，用于Pro付费。
