export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[color:var(--cp-border)] py-6 px-4 md:px-8 hidden md:block">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="font-signature text-[color:var(--cp-accent)] text-lg" data-testid="footer-signature">
          Made by Raj with Love using Emergent
        </div>
        <div className="text-[13px] text-[color:var(--cp-text-2)]" data-testid="footer-support">
          Facing a glitch? Reach out at{" "}
          <a
            href="mailto:Sunnykumawat321@gmail.com"
            className="text-[color:var(--cp-accent)] hover:underline"
            data-testid="footer-support-email"
          >
            Sunnykumawat321@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
