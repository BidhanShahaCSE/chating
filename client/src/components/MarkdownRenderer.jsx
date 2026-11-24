import { isValidElement, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

function extractTextFromChildren(node) {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromChildren).join('');
  }
  if (isValidElement(node) && node.props?.children !== undefined) {
    return extractTextFromChildren(node.props.children);
  }
  return '';
}

function getSafeHref(href) {
  if (typeof href !== 'string') return undefined;
  const trimmed = href.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }
  return undefined;
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);

  const codeChild = Array.isArray(children) ? children[0] : children;
  const className = isValidElement(codeChild) ? String(codeChild.props?.className || '') : '';
  const match = /language-([a-zA-Z0-9_+-]+)/.exec(className);
  const language = match ? match[1] : 'code';
  const rawCode = extractTextFromChildren(codeChild).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard write unavailable
    }
  };

  return (
    <div className="my-3.5 overflow-hidden rounded-xl border border-[#2a2d38] bg-[#16181f] text-[#e4e4e7]">
      <div className="flex items-center justify-between border-b border-[#252833] bg-[#1d2029] px-3.5 py-2 text-xs text-[#a1a1aa]">
        <span className="font-mono-code font-medium tracking-wide lowercase">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#d4d4d8] transition-colors hover:bg-[#2a2e3b] hover:text-white"
          aria-label="Copy code snippet"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-teal-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="font-mono-code overflow-x-auto p-3.5 text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

const MARKDOWN_COMPONENTS = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => {
    const safeHref = getSafeHref(href);
    if (!safeHref) {
      return <span>{children}</span>;
    }
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

export function MarkdownRenderer({ content, isStreaming = false }) {
  return (
    <div className="markdown-body">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </Markdown>
      {isStreaming && <span className="stream-caret" aria-hidden="true" />}
    </div>
  );
}
