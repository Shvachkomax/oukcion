import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

export default function NotFound() {
  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Оукцион">
          <span className="brandMark">О</span>
          <span>Оукцион</span>
        </Link>
        <nav className="nav" aria-label="Основные разделы">
          <Link href="/catalog">Каталог</Link>
          <Link href="/#services">Услуги</Link>
          <Link href="/#artists">Артисты</Link>
          <Link href="/#auction">Аукцион</Link>
          <Link href="/cabinet/artists">Продавцам</Link>
        </nav>
        <div className="headerActions">
          <Link className="primaryButton" href="/catalog">
            <Package size={17} />
            Каталог
          </Link>
        </div>
      </header>

      <section className="section notFoundSection">
        <span className="kicker">404</span>
        <h1>Такой страницы нет</h1>
        <p className="notFoundText">
          Возможно, товар снят с публикации, персона больше не доступна или ссылка указана с
          ошибкой.
        </p>
        <div className="notFoundActions">
          <Link className="primaryButton" href="/catalog">
            <Package size={17} />
            В каталог
          </Link>
          <Link className="secondaryLink" href="/">
            <ArrowLeft size={15} />
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
