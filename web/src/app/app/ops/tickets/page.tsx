import { redirect } from 'next/navigation';

// Moved out of the brand dashboard to the separate team admin (own login).
export default function OpsTicketsPage() {
  redirect('/admin/tickets');
}
