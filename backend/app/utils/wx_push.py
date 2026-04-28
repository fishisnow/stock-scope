import json
import os

import lark_oapi as lark
from dotenv import load_dotenv
from lark_oapi.api.im.v1 import CreateMessageRequest, CreateMessageRequestBody

load_dotenv()


def _parse_table_line(line):
    return [column.strip() for column in line.strip().strip("|").split("|")]


def _make_column_name(header, index):
    return f"col_{index}"


def _guess_data_type(header):
    if header == "排名":
        return None
    if "涨跌幅" in header:
        return "lark_md"
    if header == "股票名称":
        return "lark_md"

    numeric_tokens = ["成交额", "成交量", "量比", "换手率", "市盈率"]
    if any(token in header for token in numeric_tokens):
        return "number"
    return "text"


def _get_display_name(header):
    mapping = {
        "股票名称": "股票",
        "成交额(亿)": "成交额",
        "涨跌幅(%)": "涨跌幅",
        "成交量(万手)": "成交量",
        "换手率(%)": "换手率",
    }
    return mapping.get(header, header)


def _get_column_width(header):
    mapping = {
        "排名": "80px",
        "股票名称": "90px",
        "成交额(亿)": "80px",
        "涨跌幅(%)": "80px",
        "成交量(万手)": "90px",
        "量比": "80px",
        "换手率(%)": "80px",
        "市盈率": "80px",
    }
    return mapping.get(header)


def _format_change_value(value):
    normalized = value.replace("%", "")
    try:
        numeric_value = float(normalized)
    except ValueError:
        return value

    sign = "+" if numeric_value > 0 else ""
    formatted = f"{sign}{numeric_value:.1f}%"
    if numeric_value > 0:
        return f"<font color='red'>{formatted}</font>"
    if numeric_value < 0:
        return f"<font color='green'>{formatted}</font>"
    return formatted


def _parse_cell_value(header, value):
    if "涨跌幅" in header:
        return _format_change_value(value)
    if header == "股票链接":
        return value

    if _guess_data_type(header) != "number":
        return value

    normalized = value.replace(",", "").replace("%", "")
    try:
        return float(normalized)
    except ValueError:
        return value


def _build_table_element(headers, rows, section_title, element_id):
    columns = []
    active_indices = []
    for index, header in enumerate(headers):
        data_type = _guess_data_type(header)
        if data_type is None:
            continue

        column = {
            "name": _make_column_name(header, index),
            "display_name": _get_display_name(header),
            "data_type": data_type,
            "horizontal_align": "left" if data_type in {"text", "lark_md"} else "right",
        }
        width = _get_column_width(header)
        if width:
            column["width"] = width
        columns.append(column)
        active_indices.append(index)

    table_rows = []
    for row in rows:
        parsed_row = _parse_table_line(row)
        row_data = {}
        for column, source_index in zip(columns, active_indices):
            value = parsed_row[source_index] if source_index < len(parsed_row) else ""
            row_data[column["name"]] = _parse_cell_value(headers[source_index], value)
        table_rows.append(row_data)

    return [
        {
            "tag": "markdown",
            "content": f"**{section_title}**",
        },
        {
            "tag": "table",
            "element_id": element_id,
            "page_size": min(max(len(table_rows), 1), 10),
            "header_style": {
                "text_align": "left",
                "bold": True,
                "lines": 1,
            },
            "columns": columns,
            "rows": table_rows,
        },
    ]


def _build_card(title, message):
    elements = []
    current_market = None
    current_section = None
    current_headers = []
    current_rows = []
    table_index = 0

    def flush_rows():
        nonlocal current_headers, current_rows, table_index
        if not current_headers or not current_rows:
            current_headers = []
            current_rows = []
            return

        section_title = current_section or "数据"
        if current_market:
            section_title = f"{current_market} / {section_title}"

        element_id = f"table_{table_index}"
        elements.extend(
            _build_table_element(current_headers, current_rows, section_title, element_id)
        )
        table_index += 1
        current_headers = []
        current_rows = []

    for raw_line in message.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("【") and line.endswith("】"):
            continue
        if line.startswith("### "):
            flush_rows()
            current_market = line.replace("### ", "", 1)
            elements.append({"tag": "markdown", "content": f"## {current_market}"})
            current_section = None
            continue
        if line.startswith("#### "):
            flush_rows()
            current_section = line.replace("#### ", "", 1)
            continue
        if line.startswith("|------"):
            continue
        if line.startswith("|") and line.endswith("|"):
            parsed = _parse_table_line(line)
            if parsed and parsed[0] == "排名":
                current_headers = parsed
            else:
                current_rows.append(line)

    flush_rows()

    if not elements:
        elements.append({"tag": "markdown", "content": message})

    return {
        "schema": "2.0",
        "config": {
            "wide_screen_mode": True,
        },
        "header": {
            "title": {
                "tag": "plain_text",
                "content": title,
            },
            "template": "blue",
        },
        "body": {
            "elements": elements,
        },
    }


def _split_market_messages(message):
    lines = message.splitlines()
    title_line = "富途数据"
    current_market = None
    market_lines = {}

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            if current_market:
                market_lines.setdefault(current_market, []).append("")
            continue
        if stripped.startswith("【") and stripped.endswith("】"):
            title_line = stripped.strip("【】")
            continue
        if stripped.startswith("### "):
            current_market = stripped.replace("### ", "", 1)
            market_lines.setdefault(current_market, []).append(stripped)
            continue
        if current_market:
            market_lines.setdefault(current_market, []).append(stripped)

    messages = []
    for market_name, content_lines in market_lines.items():
        market_title = f"{title_line} - {market_name}"
        market_message = "\n".join([f"【{market_title}】", *content_lines])
        messages.append((market_title, market_message))

    if not messages:
        messages.append((title_line, message))

    return messages


def _send_interactive_message(client, receive_id, receive_id_type, title, message):
    request = CreateMessageRequest.builder() \
        .receive_id_type(receive_id_type) \
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(receive_id)
            .msg_type("interactive")
            .content(json.dumps(_build_card(title, message), ensure_ascii=False))
            .build()
        ) \
        .build()

    response = client.im.v1.message.create(request)
    if not response.success():
        raise RuntimeError(
            f"Feishu push failed: code={response.code}, msg={response.msg}, "
            f"log_id={response.get_log_id()}"
        )


def send_md_message(message):
    app_id = os.getenv("FEISHU_APP_ID")
    app_secret = os.getenv("FEISHU_APP_SECRET")
    receive_id = os.getenv("FEISHU_RECEIVE_ID")
    receive_id_type = os.getenv("FEISHU_RECEIVE_ID_TYPE", "open_id")

    if not app_id or not app_secret or not receive_id:
        raise ValueError("Missing Feishu push configuration")

    client = lark.Client.builder() \
        .app_id(app_id) \
        .app_secret(app_secret) \
        .build()

    for title, market_message in _split_market_messages(message):
        _send_interactive_message(client, receive_id, receive_id_type, title, market_message)


if __name__ == '__main__':
    send_md_message("hello world")
