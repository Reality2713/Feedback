import { ReportDetailView } from '@/components/report-detail-view';
import { isAdminEmail } from '@/lib/admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

type ReportPageProps = {
  params: {
    id: string;
  };
};

export default async function ReportPage({ params }: ReportPageProps) {
  let currentUserEmail: string | null = null;
  let canAccessAdmin = false;
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUserEmail = user?.email ?? null;
    canAccessAdmin = isAdminEmail(currentUserEmail);
  } catch {
    currentUserEmail = null;
    canAccessAdmin = false;
  }

  return (
    <main id='main-content' className='report-page'>
      <ReportDetailView id={params.id} currentUserEmail={currentUserEmail} isAdmin={false} canAccessAdmin={canAccessAdmin} />
    </main>
  );
}
