import Link from "next/link";
import AuthMenu from "./AuthMenu";
import Logo from "./Logo";

export default function Header({ name, announcement }: { name: string; announcement: string }) {
  return (
    <div className="sticky top-0 z-30 print:hidden">
      {announcement && <div role="status" className="bg-stone-900 px-4 py-2 text-center text-sm font-medium text-white">{announcement}</div>}
      <header className="border-b border-black/10 bg-[#faf6ee]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label={`${name} home`}><Logo /></Link>
          <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
            <Link href="/search" className="rounded-lg px-3 py-2 hover:bg-[#f3eee3]">Explore</Link>
            <Link href="/merchant" className="hidden rounded-lg px-3 py-2 hover:bg-[#f3eee3] sm:block">For businesses</Link>
            <AuthMenu />
          </nav>
        </div>
      </header>
    </div>
  );
}
