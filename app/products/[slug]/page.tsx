import Link from "next/link";
import { ArrowLeft, Package, User } from "lucide-react";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/artists";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 60;

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
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

      <section className="section productDetailSection">
        <div className="breadcrumb">
          <Link href="/catalog">
            <ArrowLeft size={15} />
            К каталогу
          </Link>
        </div>

        <div className="productDetailGrid">
          <div className="productDetailMedia">
            <div
              className="productDetailImage"
              style={product.image_url ? { backgroundImage: `url("${product.image_url}")` } : undefined}
            >
              {!product.image_url ? <span>Фото отсутствует</span> : null}
            </div>
          </div>
          <div className="productDetailInfo">
            <span className="kicker">
              <Package size={15} /> {product.category}
            </span>
            <h1>{product.title}</h1>
            <p className="productDetailPrice">{money.format(product.price_rub)}</p>
            <p className="productDetailMeta">
              <span>{product.quantity > 0 ? "В наличии" : "Нет в наличии"}</span>
              <span>Состояние: {product.condition}</span>
            </p>

            <Link className="artistLink" href={`/artists/${product.artist_slug}`}>
              <User size={16} />
              <div>
                <small>Персона</small>
                <strong>{product.artist_name}</strong>
              </div>
            </Link>

            <div className="productDetailBlock">
              <h2>Описание</h2>
              <p>{product.description || "Описание не указано."}</p>
            </div>
            <div className="productDetailBlock">
              <h2>Происхождение</h2>
              <p>{product.provenance || "Не указано."}</p>
            </div>
            <div className="productDetailBlock">
              <h2>Условия доставки</h2>
              <p>{product.delivery}</p>
            </div>
            <div className="productDetailNotice">
              <p>Оформление заказа будет доступно на следующем этапе.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
