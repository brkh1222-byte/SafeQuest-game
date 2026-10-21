export function RotateHint() {
  return (
    <div className="rotate-hint fixed inset-0 z-50 flex-col items-center justify-center gap-4 bg-foreground px-6 text-center text-white">
      <div className="text-7xl animate-[spin_2.5s_ease-in-out_infinite]">📱</div>
      <p className="text-2xl font-black">Утсаа хэвтээ эргүүлээрэй</p>
      <p className="text-white/70">Rotate your phone to play</p>
    </div>
  );
}
