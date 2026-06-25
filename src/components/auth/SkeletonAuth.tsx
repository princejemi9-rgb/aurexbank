"use client";

export default function SkeletonAuth() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 rounded-2xl bg-white/6" />
          <div className="h-64 rounded-2xl bg-white/4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-12 rounded-2xl bg-white/6" />
            <div className="h-12 rounded-2xl bg-white/6" />
          </div>
        </div>
      </div>
    </div>
  );
}
