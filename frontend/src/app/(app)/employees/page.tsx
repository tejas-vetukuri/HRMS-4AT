import { redirect } from 'next/navigation';

/**
 * Canonical employee directory lives at /org?tab=directory (EMP-B1).
 * This route is kept as a redirect so bookmarks and old links don't die.
 */
export default function EmployeesRedirect() {
  redirect('/org?tab=directory');
}
