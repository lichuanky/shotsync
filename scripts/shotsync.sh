#!/usr/bin/env bash
# shotsync 个人池命令行上传/取回工具
#
# 用法:
#   ./shotsync.sh upload <文件...>          上传图片或文本文件（按扩展名/MIME 判定）
#   ./shotsync.sh text <字符串或 - 表示 stdin>  上传即时文字（text/plain）
#   ./shotsync.sh list                      列出最近条目（id/类型/名称/摘要前 40 字符）
#   ./shotsync.sh get <id> [输出文件]       取回全文/原图（缺省输出文件按 id 生成）
#
# 环境变量:
#   SHOTSYNC_URL     服务地址
#   SHOTSYNC_TOKEN   访问令牌（必填，即 AUTH_TOKEN）
#
# 示例:
#   SHOTSYNC_TOKEN=xxx ./shotsync.sh upload 截图.png
#   SHOTSYNC_TOKEN=xxx ./shotsync.sh text "服务器 IP 变更为 1.2.3.4"
#   cat api.log | SHOTSYNC_TOKEN=xxx ./shotsync.sh text -
#   SHOTSYNC_TOKEN=xxx ./shotsync.sh get <id> 笔记.md

set -euo pipefail

SHOTSYNC_URL="${SHOTSYNC_URL:-}"
SHOTSYNC_TOKEN="${SHOTSYNC_TOKEN:-}"

die() { echo "错误: $*" >&2; exit 1; }
usage() { grep '^# ' "$0" | sed 's/^# //'; exit "${1:-0}"; }

need_token() { [ -n "$SHOTSYNC_TOKEN" ] || die "请设置 SHOTSYNC_TOKEN 环境变量（wrangler secret put AUTH_TOKEN 所设的值）"; }

# 上传文本文件：强制 text/plain（服务端白名单只认 text/* 与图片 MIME），
# 原始文件名经 x-filename 保留（列表 name 字段与下载文件名使用）。
upload_file() {
  local file="$1"
  [ -f "$file" ] || die "文件不存在: $file"
  local name mime
  name="$(basename "$file")"
  # 扩展名为主（file 命令对无 magic 头的小图常报 application/octet-stream），
  # MIME 兜底——与 src/textfile.ts 的判定策略同构。
  case "${name##*.}" in
    png) mime="image/png" ;;
    jpg|jpeg) mime="image/jpeg" ;;
    webp) mime="image/webp" ;;
    *) mime="$(file -b --mime-type "$file" 2>/dev/null || echo "")" ;;
  esac
  case "$mime" in
    image/png|image/jpeg|image/webp)
      # 图片直接上传（不做浏览器端转码）
      curl -fsS -H "Authorization: Bearer $SHOTSYNC_TOKEN" \
        -H "x-filename: $name" \
        -F "full=@\"$file\";type=$mime" \
        "$SHOTSYNC_URL/api/upload" >/dev/null
      ;;
    png|jpg|jpeg|webp)
      die "无法识别的图片: $name（扩展名为图片但 MIME 非图片类型）"
      ;;
    *)
      # 一切其他文件按文本上传（服务端读为 UTF-8 纯文本）
      curl -fsS -H "Authorization: Bearer $SHOTSYNC_TOKEN" \
        -H "x-filename: $name" \
        -F "full=@\"$file\";type=text/plain" \
        "$SHOTSYNC_URL/api/upload" >/dev/null
      ;;
  esac
  echo "已上传: $name"
}

upload_text() {
  local content="$1"
  if [ "$content" = "-" ]; then
    curl -fsS -H "Authorization: Bearer $SHOTSYNC_TOKEN" \
      -F 'full=@-;type=text/plain;filename=cli.txt' \
      "$SHOTSYNC_URL/api/upload" >/dev/null
  else
    printf '%s' "$content" | curl -fsS -H "Authorization: Bearer $SHOTSYNC_TOKEN" \
      -F 'full=@-;type=text/plain;filename=cli.txt' \
      "$SHOTSYNC_URL/api/upload" >/dev/null
  fi
  echo "已上传文字（cli.txt）"
}

cmd="${1:-help}"
case "$cmd" in
  upload)
    shift; [ $# -ge 1 ] || die "用法: $0 upload <文件>"; need_token
    for f in "$@"; do upload_file "$f"; done
    ;;
  text)
    shift; [ $# -ge 1 ] || die "用法: $0 text <字符串 或 ->"; need_token
    upload_text "$1"
    ;;
  list)
    need_token
    curl -fsS -H "Authorization: Bearer $SHOTSYNC_TOKEN" "$SHOTSYNC_URL/api/list" \
      | python3 -c '
import json, sys
data = json.load(sys.stdin)
for it in data.get("items", []):
    ct = it.get("contentType", "")
    kind = "text" if ct.startswith("text/") else "image"
    name = it.get("name") or "-"
    snippet = (it.get("snippet") or "").replace("\n", " ")[:40]
    print(it["id"], " ", kind.ljust(5), " ", name.ljust(20), " ", snippet)
'
    ;;
  get)
    shift; [ $# -ge 1 ] || die "用法: $0 get <id> [输出文件]"; need_token
    id="$1"; out="${2:-}"
    if [ -z "$out" ]; then
      # 未指定输出文件时按响应 Content-Type 推导后缀（/i/ 不返回原始文件名）。
      # /i/ 不支持 HEAD（405），用 GET + -r 0-0 单字节区间探测响应头。
      ct="$(curl -fsS -D - -o /dev/null -r 0-0 -H "Authorization: Bearer $SHOTSYNC_TOKEN" \
        "$SHOTSYNC_URL/i/$id?size=full" \
        | tr -d '\r' | awk 'tolower($1)=="content-type:"{print $2}')" || ct=""
      case "$ct" in
        image/png) ext=png ;;
        image/jpeg) ext=jpg ;;
        image/webp) ext=webp ;;
        text/*) ext=txt ;;
        *) ext=bin ;;
      esac
      out="$id.$ext"
    fi
    curl -fsS -H "Authorization: Bearer $SHOTSYNC_TOKEN" -o "$out" \
      "$SHOTSYNC_URL/i/$id?size=full"
    echo "已保存: $out"
    ;;
  help|--help|-h) usage ;;
  *) die "未知命令: $cmd（可用: upload / text / list / get）" ;;
esac
