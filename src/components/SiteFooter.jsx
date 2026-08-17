export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        포토착착 MVP · <span>{new Date().getFullYear()}</span>
      </span>
      <span>원본은 유지합니다. 정리는 복사로만.</span>
    </footer>
  );
}
