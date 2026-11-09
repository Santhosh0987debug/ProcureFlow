import { BrandMark } from '../components/layout/BrandMark';

export function AuthLoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-espresso px-6">
      <div className="flex flex-col items-center gap-6">
        <BrandMark />
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-ivory/15 border-t-ivory/80"
          aria-hidden="true"
        />
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ivory/35">
          Restoring your workspace
        </p>
      </div>
    </div>
  );
}
