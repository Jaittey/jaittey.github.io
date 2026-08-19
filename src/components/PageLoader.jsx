export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="loader" />
      <span>Opening module…</span>
    </div>
  );
}
