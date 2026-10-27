import { redirect } from 'next/navigation';

export default function RegisterPage() {
  // Registration temporarily disabled by client demand.
  redirect('/login');
}
