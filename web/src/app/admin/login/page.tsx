import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { AdminLoginForm } from './AdminLoginForm';

export const metadata = { title: 'Admin · shoppingmate', robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect('/admin/tickets');
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-text-primary">
      <div className="card-v2 w-full max-w-sm p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">shoppingmate · internal</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em]">Team sign in</h1>
        <p className="mt-1 text-sm text-text-secondary">For the shoppingmate team only. Brand owners sign in at /login.</p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
