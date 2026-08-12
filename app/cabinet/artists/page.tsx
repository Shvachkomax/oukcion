import Link from "next/link";
import { ArrowLeft, BadgeCheck, LockKeyhole, PackagePlus } from "lucide-react";
import { getCabinetArtists, getCabinetProducts } from "@/lib/artists";
import { ArtistManager } from "./artist-manager";
import { ProductManager } from "./product-manager";
import { isCabinetAllowed, loginToCabinet } from "./actions";

type CabinetPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const revalidate = 0;

export default async function CabinetArtistsPage({
  searchParams
}: CabinetPageProps) {
  const [{ error }, allowed] = await Promise.all([
    searchParams,
    isCabinetAllowed()
  ]);

  if (!allowed) {
    return (
      <main className="cabinetPage">
        <section className="cabinetShell compact">
          <Link className="backLink" href="/">
            <ArrowLeft size={16} />
            На сайт
          </Link>
          <div className="cabinetHero">
            <span className="kicker">
              <LockKeyhole size={15} /> кабинет
            </span>
            <h1>Вход в кабинет</h1>
            <p>
              Введите код доступа. После входа можно создавать карточки
              артистов, которые сохраняются в базе и появляются на главной.
            </p>
          </div>
          <form action={loginToCabinet} className="cabinetForm">
            <label>
              Код доступа
              <input name="accessCode" required type="password" />
            </label>
            <button className="primaryButton" type="submit">
              <LockKeyhole size={17} />
              Войти
            </button>
            {error === "wrong-code" ? (
              <p className="formStatus error">Неверный код доступа.</p>
            ) : null}
            {error === "access-not-configured" ? (
              <p className="formStatus error">
                В Vercel не настроен CABINET_ACCESS_CODE.
              </p>
            ) : null}
          </form>
        </section>
      </main>
    );
  }

  const [artists, products] = await Promise.all([
    getCabinetArtists(),
    getCabinetProducts()
  ]);

  return (
    <main className="cabinetPage">
      <section className="cabinetShell">
        <Link className="backLink" href="/">
          <ArrowLeft size={16} />
          На сайт
        </Link>
        <div className="cabinetHero">
          <span className="kicker">
            <BadgeCheck size={15} /> кабинет артистов
          </span>
          <h1>Карточка артиста</h1>
          <p>
            Здесь создаётся витринная карточка артиста. Если включить
            “Показывать на главной”, карточка появится в блоке артистов.
          </p>
        </div>

        <ArtistManager artists={artists} />

        <div className="cabinetPanel">
          <div className="cabinetPanelHead">
            <div>
              <span className="kicker">
                <PackagePlus size={15} /> товары артиста
              </span>
              <h2>Физический товар</h2>
              <p>
                Добавьте предмет, который принадлежит артисту или связан с его
                творческой историей. Товар сохраняется отдельно и привязывается
                к выбранной карточке артиста.
              </p>
            </div>
          </div>
          {artists.length > 0 ? (
            <ProductManager artists={artists} products={products} />
          ) : (
            <p className="emptyState">
              Сначала сохраните карточку артиста, затем можно будет добавить
              физический товар.
            </p>
          )}
        </div>

      </section>
    </main>
  );
}
