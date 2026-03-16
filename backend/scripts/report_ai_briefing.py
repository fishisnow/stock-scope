#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenClaw Agent AI 简报上报脚本

用法示例：
    python scripts/report_ai_briefing.py \
      --publisher "openclaw-agent" \
      --content "今日AI简报内容..."

    python scripts/report_ai_briefing.py \
      --publisher "openclaw-agent" \
      --content-file "./briefing.txt" \
      --api-key "your-report-key"
"""

import argparse
import os
import sys
from typing import Optional

import requests


def read_content(content: Optional[str], content_file: Optional[str]) -> str:
    if content and content.strip():
        return content.strip()
    if content_file:
        with open(content_file, 'r', encoding='utf-8') as f:
            return f.read().strip()
    return ""


def main():
    parser = argparse.ArgumentParser(description="向 stock-scope 后端上报 AI 简报")
    parser.add_argument("--api-url", default=os.getenv("BRIEFING_REPORT_API_URL", "http://localhost:5001"))
    parser.add_argument("--publisher", required=True, help="简报发布者，例如 openclaw-agent")
    parser.add_argument("--content", help="简报正文")
    parser.add_argument("--content-file", help="从文件读取简报正文")
    parser.add_argument("--published-at", help="发布时间(ISO8601)，默认由服务端生成")
    parser.add_argument("--api-key", default=os.getenv("OPENCLAW_AGENT_REPORT_KEY", ""))
    parser.add_argument("--timeout", type=int, default=15)

    args = parser.parse_args()

    content = read_content(args.content, args.content_file)
    if not content:
        print("❌ 请通过 --content 或 --content-file 提供简报正文")
        sys.exit(1)

    url = f"{args.api_url.rstrip('/')}/api/briefings/report"
    payload = {
        "publisher": args.publisher,
        "content": content
    }
    if args.published_at:
        payload["published_at"] = args.published_at

    headers = {"Content-Type": "application/json"}
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=args.timeout)
        result = response.json()
    except requests.RequestException as e:
        print(f"❌ 请求失败: {e}")
        sys.exit(1)
    except ValueError:
        print(f"❌ 服务返回了非JSON响应，HTTP {response.status_code}")
        sys.exit(1)

    if response.ok and result.get("success"):
        data = result.get("data", {})
        print("✅ 上报成功")
        print(f"- id: {data.get('id')}")
        print(f"- publisher: {data.get('publisher')}")
        print(f"- published_at: {data.get('published_at')}")
        return

    print(f"❌ 上报失败，HTTP {response.status_code}")
    print(result)
    sys.exit(1)


if __name__ == "__main__":
    main()
