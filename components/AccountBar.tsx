import { signOut } from "@/app/auth/actions";

export default function AccountBar({ email, role }: { email: string; role: string }) {
  return <div className="account-bar"><div><span>PRIVATE WORKSPACE</span><strong>{email}</strong><small>{role}</small></div><form action={signOut}><button type="submit">Sign out</button></form></div>;
}
