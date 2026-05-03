import { PublicCasePage } from "@/components/platform/PublicCasePage";

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <PublicCasePage caseId={caseId} />;
}
