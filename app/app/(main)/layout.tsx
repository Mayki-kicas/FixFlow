import { getCurrentUser, getVisibleCriticalTicketsCountForUser } from '@/lib/session';
import Header from '@/components/Header';
import ExpressiveSurface from '@/components/ExpressiveSurface';
import { redirect } from 'next/navigation';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const criticalTicketsCount = await getVisibleCriticalTicketsCountForUser(user);

  return (
    <div className="min-h-screen bg-transparent">
      <ExpressiveSurface />
      <Header
        user={{
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
        }}
        criticalTicketsCount={criticalTicketsCount}
      />
      <main className="relative z-10">{children}</main>
    </div>
  );
}
