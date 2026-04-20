import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageBodyProps {
  text: string;
}

export function MarkdownMessageBody({ text }: MarkdownMessageBodyProps) {
  return (
    <div className="chat-message-body chat-message-body-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a(props) {
            return <a {...props} target="_blank" rel="noreferrer" />;
          },
          pre(props) {
            return (
              <div className="chat-code-wrap">
                <pre {...props} />
              </div>
            );
          },
          table(props) {
            return (
              <div className="chat-table-wrap">
                <table {...props} />
              </div>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
