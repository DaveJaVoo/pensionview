
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <LoadingSpinner size={64} />
      <p className="mt-4 text-xl text-foreground font-semibold font-headline">
        Loading Your Pension Pilot...
      </p>
    </div>
  );
}
