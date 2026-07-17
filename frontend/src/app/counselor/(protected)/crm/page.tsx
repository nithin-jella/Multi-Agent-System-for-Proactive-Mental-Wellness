import { redirect } from 'next/navigation';

export default function CounselorCRMRedirect() {
  redirect('/counselor/patients');
}
