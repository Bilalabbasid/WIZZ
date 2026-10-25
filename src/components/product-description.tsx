import React from "react";

/**
 * Renders a seller-written plain-text description with light formatting:
 *   blank line   → new paragraph
 *   "## Heading" (one to six #) → section heading
 *   "- item" / "* item" / "• item" → bullet list
 *   **text**     → bold
 * Everything is rendered as React text nodes; HTML in the description is shown
 * literally and never interpreted.
 */
type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; lines: string[] };

const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function parseDescription(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "list", items: list });
    list = [];
  };

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = line.match(BULLET);
    const heading = line.match(HEADING);

    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** segments; odd indexes are the bold parts
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export function ProductDescription({
  text,
  className = "",
  emptyText = "No description provided.",
}: {
  text: string;
  className?: string;
  emptyText?: string;
}) {
  const blocks = parseDescription(text || "");
  if (blocks.length === 0) {
    return <p className={`text-sm text-slate-500 ${className}`}>{emptyText}</p>;
  }

  return (
    <div className={`space-y-3 text-sm text-slate-700 leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h4 key={i} className="text-sm font-bold text-slate-900 pt-1">
              {renderInline(block.text)}
            </h4>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1 marker:text-emerald-600">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
