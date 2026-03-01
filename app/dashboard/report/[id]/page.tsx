import { redirect } from 'next/navigation';
import { ReportDetailView } from '@/components/report-detail-view';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

type DashboardReportPageProps = {
  params: {
    id: string;
  };
};

export default async function DashboardReportPage({ params }: DashboardReportPageProps) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/dashboard/report/${params.id}`);
  }

  if (!isAdminEmail(user.email)) {
    redirect(`/report/${params.id}`);
  }

  return (
    <main id='main-content' className='report-page'>
      <ReportDetailView id={params.id} currentUserEmail={user.email ?? null} isAdmin canAccessAdmin />
    </main>
  );
}
