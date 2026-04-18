import { PublicProfilePage } from "@/components/platform/PublicProfilePage";

export default async function PublicUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <PublicProfilePage userId={userId} />;
}