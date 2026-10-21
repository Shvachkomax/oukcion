import Link from "next/link";
import { ArrowLeft, BadgeCheck, Package, User } from "lucide-react";
import { notFound } from "next/navigation";
import { getArtistBySlug, getPublishedProductsByArtistSlug } from "@/lib/artists";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

type ArtistPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 60;

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const [artist, products] = await Promise.all([
    getArtistBySlug(slug),
    getPublishedProductsByArtistSlug(slug)
  ]);

  if (!artist) {
    notFound();
  }

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

      <section className="section artistDetailSection">
        <div className="breadcrumb">
          <Link href="/">
            <ArrowLeft size={15} />
            На главную
          </Link>
        </div>

        <div className="artistDetailHeader">
          <div
            className="artistDetailPortrait"
            style={artist.image_url ? { backgroundImage: `url("${artist.image_url}")` } : undefined}
          >
            {!artist.image_url ? <User size={48} /> : null}
          </div>
          <div className="artistDetailInfo">
            <span className="kicker">
              <BadgeCheck size={15} /> {artist.verified ? "проверенная персона" : "персона"}
            </span>
            <h1>{artist.name}</h1>
            <p className="artistDetailMeta">
              {artist.category}
              {artist.city ? ` • ${artist.city}` : ""}
            </p>
            <p className="artistDetailBio">{artist.bio}</p>
            <div className="artistDetailStats">
              <span><strong>{products.length}</strong>опубликованных товаров</span>
              <span><strong>{artist.auction_lots_count}</strong>лотов</span>
              <span><strong>{artist.services_count}</strong>услуг</span>
            </div>
          </div>
        </div>

        <div className="sectionHead">
          <div>
            <span className="kicker">
              <Package size={15} /> товары персоны
            </span>
            <h2>Опубликованные позиции</h2>
          </div>
          <Link href="/catalog">Весь каталог</Link>
        </div>

        {products.length === 0 ? (
          <p className="emptyState">У этой персоны пока нет опубликованных товаров.</p>
        ) : (
          <div className="cards productGrid">
            {products.map((product) => (
              <Link className="productCard productCardLink" key={product.id} href={`/products/${product.slug}`}>
                <div
                  className="productVisual"
                  style={product.image_url ? { backgroundImage: `url("${product.image_url}")` } : undefined}
                >
                  <span>{product.title}</span>
                </div>
                <div className="cardBody">
                  <p>{product.category}</p>
                  <h3>{product.title}</h3>
                  <div className="cardFooter">
                    <strong>{money.format(product.price_rub)}</strong>
                    <span>{product.quantity > 0 ? "В наличии" : "Нет в наличии"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
