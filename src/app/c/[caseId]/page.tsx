import { CaseViewer } from "@/components/platform/CaseViewer";

export default async function PublicCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseViewer caseId={caseId} />;
}