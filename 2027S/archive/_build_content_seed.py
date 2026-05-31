"""
Parse a Notion HTML export of a university page and emit a content_seed row
matching the 12-column `content` sheet structure.

The script produces a SEED draft only -- fields that require OIA curation
(why_yonsei, refined student tips, cover image URL, etc.) are left blank
or dumped raw so a human editor can refine them in the sheet.

Usage:
    python _build_content_seed.py path/to/notion_export.html
    python _build_content_seed.py path/to/notion_export.html --output seed.csv
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
import urllib.parse
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

# Force UTF-8 on Windows consoles (cp949 default chokes on Korean/French chars).
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Column order matches the proposed `content` sheet (12 columns).
CONTENT_COLUMNS = [
    'university_name',
    'cover_image_url',
    'cover_image_credit',
    'gallery_urls',
    'video_links',
    'about_text',
    'why_yonsei',
    'campus_location',
    'accommodation',
    'student_tips',
    'useful_links',
    'last_updated',
]

# Max items emitted per multi-value cell (matches dashboard caps).
MAX_VIDEOS = 5
MAX_LINKS = 10


# --------------------------------------------------------------------------
# Generic helpers
# --------------------------------------------------------------------------
def text_of(el) -> str:
    if el is None:
        return ''
    return el.get_text(separator='\n', strip=True)


def is_video_url(url: str) -> bool:
    if not url:
        return False
    return any(host in url for host in ('youtu.be', 'youtube.com', 'vimeo.com'))


def normalize_label(s: str) -> str:
    """Strip emojis and excess whitespace from a section heading."""
    s = re.sub(r'[^\w\s/&()-]+', '', s, flags=re.UNICODE)
    return s.strip()


# --------------------------------------------------------------------------
# Notion-export specific extractors
# --------------------------------------------------------------------------
def extract_properties(article) -> dict:
    """Pull key/value pairs from the page-header properties table."""
    props = {}
    table = article.find('table', class_='properties')
    if not table:
        return props
    for row in table.find_all('tr'):
        th = row.find('th')
        td = row.find('td')
        if th and td:
            props[text_of(th)] = text_of(td)
    return props


def find_section_blocks(article, keywords):
    """Return all top-level body elements that fall between the matching
    h3 heading and the next h3 heading.

    Notion HTML wraps each block in <div style="display:contents">, so we
    walk siblings of the h3's parent."""
    keywords_lc = [k.lower() for k in keywords]
    for h3 in article.find_all('h3', class_='block-color-blue_background'):
        label = normalize_label(text_of(h3)).lower()
        if any(kw in label for kw in keywords_lc):
            blocks = []
            sib = h3.parent.find_next_sibling()
            while sib is not None:
                # Stop when the next section heading is encountered.
                next_h3 = sib.find('h3', class_='block-color-blue_background')
                if next_h3:
                    break
                blocks.append(sib)
                sib = sib.find_next_sibling()
            return blocks
    return []


def text_from_blocks(blocks, include_tags=('p', 'blockquote', 'summary')) -> str:
    """Collapse a list of body blocks into newline-separated text.

    'li' is intentionally excluded: in Notion exports a <li> wraps
    <details><summary>+<p>+<figure>... so harvesting li produces the
    combined text alongside the individually-harvested children, yielding
    duplicate paragraphs.

    Full set-based deduplication catches the same paragraph appearing in
    multiple sibling blocks (e.g. summary repeated in details body)."""
    seen = set()
    out = []
    for blk in blocks:
        for el in blk.find_all(include_tags):
            t = text_of(el)
            if not t:
                continue
            # Skip lines that are only a bare URL -- they belong in links.
            if re.match(r'^https?://\S+$', t):
                continue
            if t in seen:
                continue
            seen.add(t)
            out.append(t)
    return '\n\n'.join(out).strip()


def extract_videos(article):
    """Find every YouTube/Vimeo link anywhere in the body. Return [(label, url)]."""
    found = []
    for a in article.find_all('a'):
        href = a.get('href', '')
        if not is_video_url(href):
            continue
        # Prefer the closest figure caption / bookmark-title if present.
        label = ''
        title_el = a.find('div', class_='bookmark-title')
        if title_el:
            label = text_of(title_el)
        if not label:
            label = text_of(a)
        if not label or label.startswith('http'):
            label = 'Video'
        found.append((label, href))
    # De-duplicate by URL while preserving first-seen order.
    seen = set()
    unique = []
    for label, url in found:
        if url in seen:
            continue
        seen.add(url)
        unique.append((label, url))
    return unique


def fallback_link_label(url: str) -> str:
    """Generate a readable label when the source link has no human title
    (e.g. plain anchor where the visible text is just the URL itself)."""
    if not url:
        return 'Link'
    # PDF: use the file name (URL-decoded, no extension noise)
    if url.lower().endswith('.pdf'):
        try:
            name = url.rsplit('/', 1)[-1]
            name = urllib.parse.unquote(name)  # %20 -> space
            name = name.rsplit('.', 1)[0]      # drop ".pdf"
            name = re.sub(r'[_+]+', ' ', name) # underscore/plus -> space
            name = re.sub(r'\s+', ' ', name).strip()
            return name or 'PDF'
        except Exception:
            return 'PDF'
    # Map short URLs to friendly names
    if 'maps.app.goo.gl' in url or 'goo.gl/maps' in url:
        return 'Google Maps'
    if 'youtu.be' in url or 'youtube.com' in url:
        return 'YouTube'
    # Default: extract domain
    m = re.match(r'https?://([^/]+)', url)
    return m.group(1) if m else 'Link'


def extract_useful_links(article):
    """Bookmark blocks + non-video external links. Returns [(label, url)]."""
    found = []
    # 1) Bookmark <a class="bookmark"> with title inside.
    for a in article.find_all('a', class_='bookmark'):
        href = a.get('href', '')
        if not href or is_video_url(href):
            continue
        title_el = a.find('div', class_='bookmark-title')
        title = text_of(title_el) if title_el else ''
        if not title or title == href:
            title = fallback_link_label(href)
        found.append((title, href))
    # 2) Plain <a> inside <div class="source"> (Notion "source" blocks for files/links)
    for src in article.find_all('div', class_='source'):
        a = src.find('a')
        if not a:
            continue
        href = a.get('href', '')
        if not href or is_video_url(href):
            continue
        # Skip Notion-internal file references (relative paths to attached files).
        if not href.startswith('http'):
            continue
        label = text_of(a)
        if not label or label == href:
            label = fallback_link_label(href)
        found.append((label, href))
    # De-duplicate by URL.
    seen = set()
    unique = []
    for label, url in found:
        if url in seen:
            continue
        seen.add(url)
        unique.append((label, url))
    return unique


def extract_student_tips_raw(article) -> str:
    """Dump every toggle (☀️/🏞️/🍽️/📚/➕) under 'Student Report Highlight'
    as topic + quotes. Editor will refine into curated bullet tips."""
    blocks = find_section_blocks(article, ['Student Report', 'Student Tips', 'Tips'])
    chunks = []
    for blk in blocks:
        for details in blk.find_all('details'):
            summary = details.find('summary')
            if not summary:
                continue
            topic = text_of(summary)
            quotes = [text_of(q) for q in details.find_all('blockquote') if text_of(q)]
            if not quotes:
                continue
            chunks.append(f'[{topic}]\n' + '\n---\n'.join(quotes))
    return '\n\n'.join(chunks).strip()


def build_pipe_lines(pairs, cap):
    """Format [(label, url), ...] into the sheet's `라벨 | URL` newline format."""
    if not pairs:
        return ''
    return '\n'.join(f'{label} | {url}' for label, url in pairs[:cap])


# --------------------------------------------------------------------------
# Top-level driver
# --------------------------------------------------------------------------
def parse_one(html_path: Path) -> dict:
    html = html_path.read_text(encoding='utf-8')
    soup = BeautifulSoup(html, 'html.parser')
    article = soup.find('article', class_='page')
    if article is None:
        raise RuntimeError(f'No <article class="page"> in {html_path}')

    title = text_of(article.find('h1', class_='page-title'))
    props = extract_properties(article)  # captured but unused -- master sheet owns these

    about_blocks       = find_section_blocks(article, ['About'])
    campus_blocks      = find_section_blocks(article, ['Campus'])
    accommodation_blks = find_section_blocks(article, ['Accommodation', 'Housing'])

    return {
        'university_name':     title,
        'cover_image_url':     '',
        'cover_image_credit':  '',
        'gallery_urls':        '',
        'video_links':         build_pipe_lines(extract_videos(article), MAX_VIDEOS),
        'about_text':          text_from_blocks(about_blocks),
        'why_yonsei':          '',
        'campus_location':     text_from_blocks(campus_blocks),
        'accommodation':       text_from_blocks(accommodation_blks),
        'student_tips':        extract_student_tips_raw(article),
        'useful_links':        build_pipe_lines(extract_useful_links(article), MAX_LINKS),
        'last_updated':        date.today().isoformat(),
    }, props


def write_csv(row: dict, out_path: Path) -> None:
    with out_path.open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=CONTENT_COLUMNS, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerow(row)


def print_summary(row: dict, props: dict) -> None:
    print(f'\n=== Parsed: {row["university_name"]} ===\n')
    print('Properties captured from page header (NOT written to content sheet -- master sheet owns these):')
    for k, v in props.items():
        print(f'  - {k}: {v[:80]}{"..." if len(v) > 80 else ""}')

    print('\nContent sheet row preview:')
    for col in CONTENT_COLUMNS:
        v = row.get(col, '')
        if not v:
            print(f'  [ ] {col:20s} (empty -- needs curation)')
        else:
            preview = v.replace('\n', ' / ')
            preview = preview[:90] + ('...' if len(v) > 90 else '')
            print(f'  [x] {col:20s} {preview}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html_path', type=Path)
    ap.add_argument('--output', type=Path, default=Path('content_seed.csv'))
    args = ap.parse_args()

    row, props = parse_one(args.html_path)
    write_csv(row, args.output)
    print_summary(row, props)
    print(f'\nCSV written: {args.output.resolve()}')


if __name__ == '__main__':
    main()
