import { stageClass } from "@/lib/cp";

export default function StageBadge({ stage }) {
  return (
    <span className={`cp-stage-pill ${stageClass(stage)}`} data-testid={`stage-badge-${stage}`}>
      {stage}
    </span>
  );
}
