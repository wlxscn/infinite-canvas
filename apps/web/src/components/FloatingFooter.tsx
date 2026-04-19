interface FloatingFooterProps {
  assetCountText: string;
  scaleText: string;
}

export function FloatingFooter({ assetCountText, scaleText }: FloatingFooterProps) {
  return (
    <footer className="floating-footer">
      <div className="footer-status">
        <span className="mini-dot" />
        <span>{assetCountText}</span>
        <span>{scaleText}</span>
      </div>
    </footer>
  );
}
