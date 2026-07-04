export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[color:var(--cp-border)] py-5 px-4 md:px-8 hidden md:block">
      <div className="max-w-7xl mx-auto text-[13px] text-[color:var(--cp-text-2)] text-right" data-testid="footer-support">
        Facing a glitch? Reach out at{" "}
        <a
          href="mailto:Sunnykumawat321@gmail.com"
          className="text-[color:var(--cp-accent)] hover:underline"
          data-testid="footer-support-email"
        >
          Sunnykumawat321@gmail.com
        </a>
      </div>
    </footer>
  );
}
