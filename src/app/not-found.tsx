import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <span className="text-7xl" aria-hidden>
        🐿️
      </span>
      <h1 className="text-3xl font-black">Ой! Энэ хуудас алга.</h1>
      <p className="font-semibold text-muted">Тарвага энэ газрыг олсонгүй. Page not found.</p>
      <Link href="/" className="btn">
        Нүүр хуудас
      </Link>
    </main>
  );
}
