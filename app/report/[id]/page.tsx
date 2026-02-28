import { ReportDetailView } from '@/components/report-detail-view';

type ReportPageProps = {
  params: {
    id: string;
  };
};

export default function ReportPage({ params }: ReportPageProps) {
  return (
    <main id='main-content' className='report-page'>
      <ReportDetailView id={params.id} />
    </main>
  );
}
