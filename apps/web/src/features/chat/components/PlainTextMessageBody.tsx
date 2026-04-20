interface PlainTextMessageBodyProps {
  text: string;
}

export function PlainTextMessageBody({ text }: PlainTextMessageBodyProps) {
  return (
    <div className="chat-message-body">
      <p>{text}</p>
    </div>
  );
}
