import { Sparkles } from "lucide-react";

interface Props {
  status: string;
}

export default function ProcessingScreen({ status }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <Sparkles className="h-8 w-8 animate-pulse text-coral" />
      <h1 className="mt-5 text-[24px] font-semibold text-text">Extracting...</h1>
      <p className="mt-2 text-[14px] text-text-secondary">{status}</p>
      <p className="mt-1 text-[12px] text-text-secondary">
        This may take a while
      </p>
    </div>
  );
}
