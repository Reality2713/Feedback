import Link from 'next/link';
import { RoadmapBoard } from '@/components/roadmap-board';

export default function RoadmapPage() {
  return (
    <main className='pf-main roadmap-page'>
      <header className='pf-grid-header'>
        <div className='pf-brick'>PUBLIC ROADMAP</div>
        <h1 className='hero-title'>
          MISSION
          <br />
          ROADMAP
        </h1>
        <p className='hero-meta'>Follow planned, active, and shipped work from the same live feedback stream.</p>
      </header>

      <div className='roadmap-page-actions'>
        <Link href='/' className='modal-close report-back'>
          BACK_TO_FEEDBACK
        </Link>
      </div>

      <RoadmapBoard mode='full' />
    </main>
  );
}
