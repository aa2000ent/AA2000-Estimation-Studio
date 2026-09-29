import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders AI chat markdown (tables, lists, headings, code, links) as native
 * React elements in the chat's dark theme. remark-gfm handles GitHub-flavoured
 * tables/task lists; react-markdown never renders raw HTML, so no XSS surface.
 */
const components: Components = {
  p: ({ children }) => <p className="text-slate-200">{children}</p>,
  h1: ({ children }) => (
    <h1 className="font-bold text-sm text-indigo-300 pt-1 pb-0.5 border-b border-slate-700/50">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-bold text-sm text-indigo-300 pt-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-semibold text-slate-100 pt-0.5">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="font-semibold text-slate-100">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="font-semibold text-slate-300">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="font-medium text-slate-400">{children}</h6>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 marker:text-indigo-400">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 marker:text-indigo-400">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-slate-200 leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
  del: ({ children }) => (
    <del className="text-slate-400 line-through">{children}</del>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-500/60 pl-3 text-slate-400 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-slate-700" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full border-collapse text-left text-[11px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-slate-700 px-2 py-1 font-semibold text-slate-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-700 px-2 py-1 text-slate-200">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="odd:bg-slate-900/60 even:bg-slate-900/30">{children}</tr>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-3">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const raw = String(children ?? '');
    const isBlock = raw.includes('\n') || /language-/.test(className || '');

    if (isBlock) {
      return (
        <code className="block whitespace-pre font-mono text-[11px] leading-5 text-indigo-200">
          {children}
        </code>
      );
    }

    return (
      <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300 border border-slate-700">
        {children}
      </code>
    );
  },
};

export const MarkdownMessage: React.FC<{ children: string }> = ({
  children,
}) => {
  if (!children) return null;

  return (
    <div className="space-y-1.5 leading-relaxed font-sans text-xs md:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;
