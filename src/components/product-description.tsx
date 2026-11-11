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
      <strong key={i} className="font-semibold text-ink">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

const SIZES = {
  // Compact: seller editor previews and small panels
  sm: {
    root: "space-y-3 text-sm leading-relaxed text-ink-2",
    empty: "text-sm text-mute",
    heading: "pt-1 text-sm font-semibold text-ink",
    list: "list-disc space-y-1 pl-5 marker:text-mute-2",
  },
  // Reading size: product page "About this product" (19px / 1.6)
  lg: {
    root: "space-y-5 text-[17px] leading-[1.6] tracking-[-0.01em] text-brand-700 sm:text-[19px]",
    empty: "text-[17px] text-mute sm:text-[19px]",
    heading: "pt-2 text-[19px] font-semibold tracking-[-0.02em] text-ink sm:text-[21px]",
    list: "list-disc space-y-2 pl-6 marker:text-mute-2",
  },
} as const;

export function ProductDescription({
  text,
  className = "",
  emptyText = "No description provided.",
  size = "sm",
}: {
  text: string;
  className?: string;
  emptyText?: string;
  size?: "sm" | "lg";
}) {
  const s = SIZES[size];
  const blocks = parseDescription(text || "");
  if (blocks.length === 0) {
    return <p className={`${s.empty} ${className}`}>{emptyText}</p>;
  }

  return (
    <div className={`${s.root} ${className}`}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          // Under the product page's h2 the sections are h3; compact previews keep h4.
          const Heading = size === "lg" ? "h3" : "h4";
          return (
            <Heading key={i} className={s.heading}>
              {renderInline(block.text)}
            </Heading>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className={s.list}>
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
