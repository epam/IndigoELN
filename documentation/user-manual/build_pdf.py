"""Build the Indigo ELN user manual PDF from the Markdown files in this folder.

Run from anywhere:
    uv run --no-project --with markdown python docs/user-manual/build_pdf.py
    uv run --no-project --with markdown python docs/user-manual/build_pdf.py --no-internal -o manual.pdf

Needs Google Chrome or Microsoft Edge installed (used headless to print the PDF).
"""
import argparse
import os
import pathlib
import re
import shutil
import subprocess
import sys

import markdown

HERE = pathlib.Path(__file__).resolve().parent
TMP_HTML = HERE / "_build-indigo-manual.html"

ORDER = [
    "README.md",
    "01-getting-started.md",
    "02-projects-notebooks-experiments.md",
    "03-working-in-an-experiment.md",
    "04-reaction-and-stoichiometry.md",
    "05-batches-and-analytics.md",
    "06-attachments.md",
    "07-access-and-permissions.md",
    "08-administration.md",
    "appendix-glossary.md"
]

CSS = """
@page { size: A4; margin: 20mm 18mm; }
body { font-family: Segoe UI, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; }
section { page-break-before: always; }
h1 { font-size: 22pt; border-bottom: 2px solid #2a6f97; padding-bottom: 6px; color: #12476b; }
h2 { font-size: 14.5pt; margin-top: 22px; color: #12476b; page-break-after: avoid; }
h3 { font-size: 12pt; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5pt; }
th, td { border: 1px solid #b8c4ce; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #e8f0f6; }
tr { page-break-inside: avoid; }
blockquote { margin: 10px 0; padding: 6px 12px; background: #f1f6fa; border-left: 4px solid #2a6f97; }
code { background: #f2f2f2; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
a { color: #12476b; text-decoration: none; }
img { max-width: 100%; border: 1px solid #c8d2da; margin: 8px 0; page-break-inside: avoid; }
section.cover { page-break-before: avoid; }
.cover h1 { font-size: 34pt; border: none; margin-top: 80px; }
.toc { list-style: none; padding-left: 0; }
.toc li { margin: 4px 0; }
"""


def section_id(name: str) -> str:
    return name[:-3].lstrip("_")


def build_html(files: list[str]) -> str:
    sections, toc = [], []
    for name in files:
        text = (HERE / name).read_text(encoding="utf-8")
        title = re.search(r"^# (.+)$", text, re.M).group(1)
        body = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])
        body = re.sub(
            r'href="([^"#]+)\.md(#[^"]*)?"',
            lambda m: f'href="#{section_id(m.group(1) + ".md")}"',
            body,
        )
        sections.append(f'<section id="{section_id(name)}">{body}</section>')
        if name != "README.md":
            number = re.match(r"(\d\d)-", name)
            label = (f"{int(number.group(1))}. " if number else "") + title
            if name.startswith("_"):
                label += " (internal, not for readers)"
            toc.append(f'<li><a href="#{section_id(name)}">{label}</a></li>')

    cover = (
        '<section class="cover"><h1>Indigo ELN<br>User Manual</h1><h2>Contents</h2>'
        '<ul class="toc"><li><a href="#README">Overview and conventions</a></li>'
        + "".join(toc)
        + "</ul></section>"
    )
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>Indigo ELN User Manual</title><style>{CSS}</style></head>"
        f"<body>{cover}{''.join(sections)}</body></html>"
    )


def find_browser() -> str:
    candidates = [
        os.environ.get("CHROME_PATH"),
        shutil.which("chrome"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("msedge"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for path in candidates:
        if path and pathlib.Path(path).exists():
            return path
    sys.exit("Chrome or Edge not found. Set the CHROME_PATH environment variable to the browser executable.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("-o", "--output", default=str(HERE / "Indigo-ELN-User-Manual.pdf"), help="output PDF path")
    parser.add_argument("--no-internal", action="store_true", help="leave out the internal open-questions section")
    args = parser.parse_args()

    files = [f for f in ORDER if not (args.no_internal and f.startswith("_"))]
    output = pathlib.Path(args.output).resolve()
    TMP_HTML.write_text(build_html(files), encoding="utf-8")
    try:
        subprocess.run(
            [
                find_browser(),
                "--headless",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--print-to-pdf={output}",
                TMP_HTML.as_uri(),
            ],
            check=True,
            capture_output=True,
            timeout=180,
        )
    finally:
        TMP_HTML.unlink(missing_ok=True)
    if not output.exists():
        sys.exit(f"PDF was not created at {output} (is it open in another program?)")
    print(f"Created {output} ({output.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
