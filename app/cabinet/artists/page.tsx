import Link from "next/link";
import { ArrowLeft, BadgeCheck, LockKeyhole } from "lucide-react";
import { getCabinetArtists } from "@/lib/artists";
import { ArtistForm } from "./artist-form";
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

  const artists = await getCabinetArtists();

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
          <h1>Карточки публичных персон</h1>
          <p>
            Здесь создаётся витринная карточка артиста. Если включить
            “Показывать на главной”, карточка появится в блоке артистов.
          </p>
        </div>

        <ArtistForm />

        <div className="cabinetList">
          <h2>Сохранённые карточки</h2>
          {artists.length > 0 ? (
            <div className="cabinetRows">
              {artists.map((artist) => (
                <article key={artist.slug}>
                  <div>
                    <strong>{artist.name}</strong>
                    <span>
                      {artist.category}
                      {artist.city ? `, ${artist.city}` : ""}
                    </span>
                  </div>
                  <p>{artist.bio}</p>
                  <small>
                    {artist.shop_items_count} товаров ·{" "}
                    {artist.auction_lots_count} лотов ·{" "}
                    {artist.services_count} услуг
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="emptyState">Пока нет сохранённых карточек.</p>
          )}
        </div>
      </section>
    </main>
  );
}
