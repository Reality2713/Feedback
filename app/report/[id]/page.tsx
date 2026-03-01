import { ReportDetailView } from '@/components/report-detail-view';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

type ReportPageProps = {
  params: {
    id: string;
  };
};

export default async function ReportPage({ params }: ReportPageProps) {
  let currentUserEmail: string | null = null;
  let currentUserIsAdmin = false;
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    currentUserEmail = user?.email ?? null;
    currentUserIsAdmin = isAdminEmail(currentUserEmail);
  } catch {
    currentUserEmail = null;
    currentUserIsAdmin = false;
  }

  return (
    <main id='main-content' className='report-page'>
      <ReportDetailView id={params.id} currentUserEmail={currentUserEmail} isAdmin={currentUserIsAdmin} />
    </main>
  );
}
