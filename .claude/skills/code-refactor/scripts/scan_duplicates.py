#!/usr/bin/env python3
"""
代码重复检测扫描器
扫描指定目录，找出重复代码块和相似模式
"""

import os
import re
import hashlib
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
import json

@dataclass
class CodeBlock:
    file: str
    start_line: int
    end_line: int
    content: str
    normalized: str  # 标准化后的内容用于比较

@dataclass
class DuplicateGroup:
    blocks: list[CodeBlock]
    similarity: float
    pattern_type: str  # "exact", "structural", "semantic"

# 支持的文件扩展名
SUPPORTED_EXTENSIONS = {
    '.py', '.js', '.ts', '.jsx', '.tsx', 
    '.java', '.kt', '.go', '.rs',
    '.c', '.cpp', '.h', '.hpp',
    '.rb', '.php', '.swift'
}

def normalize_code(content: str, lang: str) -> str:
    """标准化代码：移除注释、空白、标准化变量名"""
    # 移除单行注释
    if lang in ('py', 'rb'):
        content = re.sub(r'#.*$', '', content, flags=re.MULTILINE)
    else:
        content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
    
    # 移除多行注释
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r'""".*?"""', '', content, flags=re.DOTALL)
    content = re.sub(r"'''.*?'''", '', content, flags=re.DOTALL)
    
    # 标准化空白
    content = re.sub(r'\s+', ' ', content)
    
    # 标准化字符串字面量
    content = re.sub(r'"[^"]*"', '"STR"', content)
    content = re.sub(r"'[^']*'", "'STR'", content)
    
    # 标准化数字
    content = re.sub(r'\b\d+\b', 'NUM', content)
    
    return content.strip()

def extract_blocks(file_path: str, min_lines: int = 5) -> Iterator[CodeBlock]:
    """从文件中提取代码块"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception:
        return
    
    ext = Path(file_path).suffix
    lang = ext[1:] if ext else 'txt'
    
    # 滑动窗口提取代码块
    window_sizes = [5, 10, 15, 20]  # 不同大小的代码块
    
    for window_size in window_sizes:
        if len(lines) < window_size:
            continue
            
        for i in range(len(lines) - window_size + 1):
            content = ''.join(lines[i:i + window_size])
            
            # 跳过空白行过多的块
            non_empty = sum(1 for line in lines[i:i + window_size] if line.strip())
            if non_empty < window_size * 0.5:
                continue
            
            normalized = normalize_code(content, lang)
            
            # 跳过太短的标准化内容
            if len(normalized) < 50:
                continue
                
            yield CodeBlock(
                file=file_path,
                start_line=i + 1,
                end_line=i + window_size,
                content=content,
                normalized=normalized
            )

def find_duplicates(directory: str, min_lines: int = 5) -> list[DuplicateGroup]:
    """扫描目录找出重复代码"""
    # 按标准化内容的哈希分组
    hash_groups: dict[str, list[CodeBlock]] = defaultdict(list)
    
    for root, _, files in os.walk(directory):
        # 跳过常见的忽略目录
        if any(skip in root for skip in ['node_modules', '.git', '__pycache__', 'venv', '.venv', 'dist', 'build']):
            continue
            
        for file in files:
            ext = Path(file).suffix
            if ext not in SUPPORTED_EXTENSIONS:
                continue
                
            file_path = os.path.join(root, file)
            
            for block in extract_blocks(file_path, min_lines):
                # 使用内容哈希作为 key
                content_hash = hashlib.md5(block.normalized.encode()).hexdigest()
                hash_groups[content_hash].append(block)
    
    # 筛选出有重复的组
    duplicates = []
    seen_files = set()  # 避免同一文件内的重叠块
    
    for blocks in hash_groups.values():
        if len(blocks) < 2:
            continue
            
        # 去重：确保不是同一文件的重叠区域
        unique_blocks = []
        for block in blocks:
            key = (block.file, block.start_line // 10)  # 粗略去重
            if key not in seen_files:
                seen_files.add(key)
                unique_blocks.append(block)
        
        if len(unique_blocks) >= 2:
            duplicates.append(DuplicateGroup(
                blocks=unique_blocks,
                similarity=1.0,
                pattern_type="exact"
            ))
    
    # 按重复次数排序
    duplicates.sort(key=lambda g: len(g.blocks), reverse=True)
    
    return duplicates[:50]  # 返回 top 50

def generate_report(duplicates: list[DuplicateGroup], output_format: str = 'text') -> str:
    """生成重复代码报告"""
    if output_format == 'json':
        data = []
        for i, group in enumerate(duplicates, 1):
            data.append({
                'id': i,
                'occurrences': len(group.blocks),
                'pattern_type': group.pattern_type,
                'locations': [
                    {
                        'file': b.file,
                        'start_line': b.start_line,
                        'end_line': b.end_line
                    }
                    for b in group.blocks
                ],
                'sample': group.blocks[0].content[:500]
            })
        return json.dumps(data, indent=2, ensure_ascii=False)
    
    # Text format
    lines = ["=" * 60]
    lines.append("代码重复检测报告")
    lines.append("=" * 60)
    lines.append(f"\n发现 {len(duplicates)} 组重复代码\n")
    
    for i, group in enumerate(duplicates[:20], 1):  # 显示 top 20
        lines.append(f"\n{'─' * 50}")
        lines.append(f"重复组 #{i} ({len(group.blocks)} 处)")
        lines.append(f"类型: {group.pattern_type}")
        lines.append("位置:")
        
        for block in group.blocks[:5]:  # 最多显示 5 个位置
            lines.append(f"  - {block.file}:{block.start_line}-{block.end_line}")
        
        if len(group.blocks) > 5:
            lines.append(f"  ... 还有 {len(group.blocks) - 5} 处")
        
        lines.append("\n代码片段预览:")
        preview = group.blocks[0].content[:300]
        lines.append("```")
        lines.append(preview)
        if len(group.blocks[0].content) > 300:
            lines.append("...")
        lines.append("```")
    
    return '\n'.join(lines)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='扫描代码重复')
    parser.add_argument('directory', help='要扫描的目录')
    parser.add_argument('--min-lines', type=int, default=5, help='最小代码块行数')
    parser.add_argument('--format', choices=['text', 'json'], default='text', help='输出格式')
    parser.add_argument('--output', '-o', help='输出文件路径')
    
    args = parser.parse_args()
    
    if not os.path.isdir(args.directory):
        print(f"错误: {args.directory} 不是有效目录")
        return 1
    
    print(f"扫描目录: {args.directory}")
    duplicates = find_duplicates(args.directory, args.min_lines)
    
    report = generate_report(duplicates, args.format)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"报告已保存到: {args.output}")
    else:
        print(report)
    
    return 0

if __name__ == '__main__':
    exit(main())
